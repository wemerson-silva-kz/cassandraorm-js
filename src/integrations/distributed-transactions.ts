import { Client } from 'cassandra-driver';
import { EventEmitter } from 'events';

export enum TransactionStatus {
  PENDING = 'pending',
  COMMITTED = 'committed',
  ABORTED = 'aborted',
  FAILED = 'failed'
}

export interface TransactionConfig {
  timeout?: number;
  consistency?: string;
  retries?: number;
}

export interface TransactionOperation {
  id: string;
  participantId: string;
  operation: 'prepare' | 'commit' | 'abort';
  query: string;
  params: any[];
  compensationQuery?: string;
  compensationParams?: any[];
}

export class DistributedTransactionManager extends EventEmitter {
  private transactions = new Map<string, {
    id: string;
    status: TransactionStatus;
    operations: TransactionOperation[];
    participants: Set<string>;
    timeout?: NodeJS.Timeout;
  }>();

  constructor(private client: Client, private keyspace: string) {
    super();
  }

  async initialize(): Promise<void> {
    // Create transaction log table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.transaction_log (
        transaction_id uuid,
        participant_id text,
        operation_id uuid,
        status text,
        query_text text,
        params text,
        timestamp timestamp,
        PRIMARY KEY (transaction_id, participant_id, operation_id)
      )
    `);
  }

  async beginTransaction(config: TransactionConfig = {}): Promise<string> {
    const transactionId = require('uuid').v4();
    
    const transaction = {
      id: transactionId,
      status: TransactionStatus.PENDING,
      operations: [],
      participants: new Set<string>(),
      timeout: config.timeout ? setTimeout(() => {
        this.abortTransaction(transactionId);
      }, config.timeout) : undefined
    };

    this.transactions.set(transactionId, transaction);
    return transactionId;
  }

  async addOperation(
    transactionId: string,
    participantId: string,
    query: string,
    params: any[],
    compensationQuery?: string,
    compensationParams?: any[]
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Transaction not found or not in pending state');
    }

    const operation: TransactionOperation = {
      id: require('uuid').v4(),
      participantId,
      operation: 'prepare',
      query,
      params,
      compensationQuery,
      compensationParams
    };

    transaction.operations.push(operation);
    transaction.participants.add(participantId);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    try {
      // Phase 1: Prepare all participants
      for (const operation of transaction.operations) {
        await this.prepareOperation(transactionId, operation);
      }

      // Phase 2: Commit all participants
      for (const operation of transaction.operations) {
        await this.commitOperation(transactionId, operation);
      }

      transaction.status = TransactionStatus.COMMITTED;
      this.emit('transaction:committed', transactionId);
    } catch (error) {
      await this.abortTransaction(transactionId);
      throw error;
    } finally {
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }
    }
  }

  async abortTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return;
    }

    try {
      // Execute compensation operations
      for (const operation of transaction.operations) {
        if (operation.compensationQuery) {
          await this.client.execute(
            operation.compensationQuery,
            operation.compensationParams || [],
            { prepare: true }
          );
        }
      }

      transaction.status = TransactionStatus.ABORTED;
      this.emit('transaction:aborted', transactionId);
    } catch (error) {
      transaction.status = TransactionStatus.FAILED;
      this.emit('transaction:failed', transactionId, error);
    } finally {
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }
    }
  }

  private async prepareOperation(transactionId: string, operation: TransactionOperation): Promise<void> {
    // Log the prepare phase
    await this.client.execute(`
      INSERT INTO ${this.keyspace}.transaction_log 
      (transaction_id, participant_id, operation_id, status, query_text, params, timestamp)
      VALUES (?, ?, ?, 'prepared', ?, ?, ?)
    `, [
      transactionId,
      operation.participantId,
      operation.id,
      operation.query,
      JSON.stringify(operation.params),
      new Date()
    ], { prepare: true });
  }

  private async commitOperation(transactionId: string, operation: TransactionOperation): Promise<void> {
    // Execute the actual operation
    await this.client.execute(operation.query, operation.params, { prepare: true });

    // Log the commit
    await this.client.execute(`
      UPDATE ${this.keyspace}.transaction_log 
      SET status = 'committed', timestamp = ?
      WHERE transaction_id = ? AND participant_id = ? AND operation_id = ?
    `, [
      new Date(),
      transactionId,
      operation.participantId,
      operation.id
    ], { prepare: true });
  }
}

// Saga Pattern Implementation
export interface SagaStep {
  id: string;
  action: () => Promise<any>;
  compensation: () => Promise<any>;
  retries?: number;
}

export class SagaOrchestrator extends EventEmitter {
  private sagas = new Map<string, {
    id: string;
    steps: SagaStep[];
    currentStep: number;
    completedSteps: string[];
    status: 'running' | 'completed' | 'failed' | 'compensating';
  }>();

  constructor(private client: Client, private keyspace: string) {
    super();
  }

  async initialize(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.saga_log (
        saga_id uuid,
        step_id text,
        status text,
        result text,
        error text,
        timestamp timestamp,
        PRIMARY KEY (saga_id, step_id)
      )
    `);
  }

  async executeSaga(steps: SagaStep[]): Promise<string> {
    const sagaId = require('uuid').v4();
    
    const saga = {
      id: sagaId,
      steps,
      currentStep: 0,
      completedSteps: [],
      status: 'running' as const
    };

    this.sagas.set(sagaId, saga);

    try {
      await this.executeNextStep(sagaId);
      return sagaId;
    } catch (error) {
      await this.compensateSaga(sagaId);
      throw error;
    }
  }

  private async executeNextStep(sagaId: string): Promise<void> {
    const saga = this.sagas.get(sagaId);
    if (!saga || saga.status !== 'running') {
      return;
    }

    if (saga.currentStep >= saga.steps.length) {
      saga.status = 'completed';
      this.emit('saga:completed', sagaId);
      return;
    }

    const step = saga.steps[saga.currentStep];
    let retries = step.retries || 0;

    while (retries >= 0) {
      try {
        const result = await step.action();
        
        // Log successful step
        await this.logSagaStep(sagaId, step.id, 'completed', result);
        
        saga.completedSteps.push(step.id);
        saga.currentStep++;
        
        // Execute next step
        await this.executeNextStep(sagaId);
        return;
      } catch (error) {
        retries--;
        
        if (retries < 0) {
          // Log failed step
          await this.logSagaStep(sagaId, step.id, 'failed', null, error.message);
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async compensateSaga(sagaId: string): Promise<void> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      return;
    }

    saga.status = 'compensating';
    
    // Execute compensation in reverse order
    for (let i = saga.completedSteps.length - 1; i >= 0; i--) {
      const stepId = saga.completedSteps[i];
      const step = saga.steps.find(s => s.id === stepId);
      
      if (step) {
        try {
          await step.compensation();
          await this.logSagaStep(sagaId, step.id, 'compensated');
        } catch (error) {
          await this.logSagaStep(sagaId, step.id, 'compensation_failed', null, error.message);
        }
      }
    }

    saga.status = 'failed';
    this.emit('saga:failed', sagaId);
  }

  private async logSagaStep(
    sagaId: string,
    stepId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<void> {
    await this.client.execute(`
      INSERT INTO ${this.keyspace}.saga_log 
      (saga_id, step_id, status, result, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      sagaId,
      stepId,
      status,
      result ? JSON.stringify(result) : null,
      error,
      new Date()
    ], { prepare: true });
  }
}
