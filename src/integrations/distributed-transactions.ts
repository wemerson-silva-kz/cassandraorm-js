import { EventEmitter } from 'events';
import type { Client } from "cassandra-driver";

export interface TransactionConfig {
  enabled?: boolean;
  timeout?: number;
  maxRetries?: number;
  coordinatorTable?: string;
  participantTable?: string;
}

export interface TransactionContext {
  transactionId: string;
  coordinatorId: string;
  participants: string[];
  status: TransactionStatus;
  startTime: Date;
  timeout: number;
  metadata?: Record<string, any>;
}

export enum TransactionStatus {
  PREPARING = 'preparing',
  PREPARED = 'prepared',
  COMMITTING = 'committing',
  COMMITTED = 'committed',
  ABORTING = 'aborting',
  ABORTED = 'aborted',
  FAILED = 'failed'
}

export interface TransactionParticipant {
  id: string;
  prepare(): Promise<boolean>;
  commit(): Promise<void>;
  abort(): Promise<void>;
}

export interface TransactionOperation {
  participantId: string;
  operation: string;
  data: any;
  compensationOperation?: string;
  compensationData?: any;
}

export class DistributedTransactionManager extends EventEmitter {
  private client: Client;
  private keyspace: string;
  private config: Required<TransactionConfig>;
  private participants = new Map<string, TransactionParticipant>();
  private activeTransactions = new Map<string, TransactionContext>();

  constructor(client: Client, keyspace: string, config: TransactionConfig = {}) {
    super();
    this.client = client;
    this.keyspace = keyspace;
    this.config = {
      enabled: true,
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      coordinatorTable: 'transaction_coordinator',
      participantTable: 'transaction_participants',
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    // Create coordinator table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.config.coordinatorTable} (
        transaction_id text PRIMARY KEY,
        coordinator_id text,
        participants list<text>,
        status text,
        start_time timestamp,
        timeout int,
        metadata map<text, text>
      )
    `);

    // Create participant table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.config.participantTable} (
        transaction_id text,
        participant_id text,
        status text,
        operation text,
        data text,
        compensation_operation text,
        compensation_data text,
        timestamp timestamp,
        PRIMARY KEY (transaction_id, participant_id)
      )
    `);
  }

  registerParticipant(participant: TransactionParticipant): void {
    this.participants.set(participant.id, participant);
  }

  async beginTransaction(
    coordinatorId: string,
    operations: TransactionOperation[],
    timeout: number = this.config.timeout
  ): Promise<string> {
    const transactionId = this.generateTransactionId();
    const participantIds = [...new Set(operations.map(op => op.participantId))];

    // Validate participants
    for (const participantId of participantIds) {
      if (!this.participants.has(participantId)) {
        throw new Error(`Unknown participant: ${participantId}`);
      }
    }

    const context: TransactionContext = {
      transactionId,
      coordinatorId,
      participants: participantIds,
      status: TransactionStatus.PREPARING,
      startTime: new Date(),
      timeout
    };

    // Store transaction context
    await this.storeTransactionContext(context);
    this.activeTransactions.set(transactionId, context);

    // Store operations for each participant
    for (const operation of operations) {
      await this.storeParticipantOperation(transactionId, operation);
    }

    this.emit('transactionStarted', { transactionId, coordinatorId, participants: participantIds });

    // Set timeout
    setTimeout(() => {
      this.handleTransactionTimeout(transactionId);
    }, timeout);

    return transactionId;
  }

  async executeTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    try {
      // Phase 1: Prepare
      await this.preparePhase(transactionId);
      
      // Phase 2: Commit
      await this.commitPhase(transactionId);
      
      this.emit('transactionCompleted', { transactionId });
    } catch (error) {
      await this.abortTransaction(transactionId);
      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  private async preparePhase(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId)!;
    
    this.emit('preparePhaseStarted', { transactionId });
    
    const preparePromises = context.participants.map(async (participantId) => {
      const participant = this.participants.get(participantId)!;
      
      try {
        const prepared = await participant.prepare();
        await this.updateParticipantStatus(transactionId, participantId, 
          prepared ? 'prepared' : 'prepare_failed');
        return prepared;
      } catch (error) {
        await this.updateParticipantStatus(transactionId, participantId, 'prepare_failed');
        throw error;
      }
    });

    const results = await Promise.allSettled(preparePromises);
    const allPrepared = results.every(result => 
      result.status === 'fulfilled' && result.value === true
    );

    if (!allPrepared) {
      context.status = TransactionStatus.FAILED;
      await this.updateTransactionStatus(transactionId, TransactionStatus.FAILED);
      throw new Error('Prepare phase failed');
    }

    context.status = TransactionStatus.PREPARED;
    await this.updateTransactionStatus(transactionId, TransactionStatus.PREPARED);
    
    this.emit('preparePhaseCompleted', { transactionId });
  }

  private async commitPhase(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId)!;
    
    context.status = TransactionStatus.COMMITTING;
    await this.updateTransactionStatus(transactionId, TransactionStatus.COMMITTING);
    
    this.emit('commitPhaseStarted', { transactionId });

    const commitPromises = context.participants.map(async (participantId) => {
      const participant = this.participants.get(participantId)!;
      
      try {
        await participant.commit();
        await this.updateParticipantStatus(transactionId, participantId, 'committed');
      } catch (error) {
        await this.updateParticipantStatus(transactionId, participantId, 'commit_failed');
        throw error;
      }
    });

    await Promise.all(commitPromises);

    context.status = TransactionStatus.COMMITTED;
    await this.updateTransactionStatus(transactionId, TransactionStatus.COMMITTED);
    
    this.emit('commitPhaseCompleted', { transactionId });
  }

  async abortTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) return;

    context.status = TransactionStatus.ABORTING;
    await this.updateTransactionStatus(transactionId, TransactionStatus.ABORTING);
    
    this.emit('abortStarted', { transactionId });

    const abortPromises = context.participants.map(async (participantId) => {
      const participant = this.participants.get(participantId)!;
      
      try {
        await participant.abort();
        await this.updateParticipantStatus(transactionId, participantId, 'aborted');
      } catch (error) {
        await this.updateParticipantStatus(transactionId, participantId, 'abort_failed');
        // Continue with other participants
      }
    });

    await Promise.allSettled(abortPromises);

    context.status = TransactionStatus.ABORTED;
    await this.updateTransactionStatus(transactionId, TransactionStatus.ABORTED);
    
    this.emit('abortCompleted', { transactionId });
  }

  private async handleTransactionTimeout(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context || context.status === TransactionStatus.COMMITTED || context.status === TransactionStatus.ABORTED) {
      return;
    }

    this.emit('transactionTimeout', { transactionId });
    await this.abortTransaction(transactionId);
  }

  private async storeTransactionContext(context: TransactionContext): Promise<void> {
    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${this.config.coordinatorTable} 
       (transaction_id, coordinator_id, participants, status, start_time, timeout, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        context.transactionId,
        context.coordinatorId,
        context.participants,
        context.status,
        context.startTime,
        context.timeout,
        context.metadata || {}
      ],
      { prepare: true }
    );
  }

  private async storeParticipantOperation(
    transactionId: string,
    operation: TransactionOperation
  ): Promise<void> {
    await this.client.execute(
      `INSERT INTO ${this.keyspace}.${this.config.participantTable} 
       (transaction_id, participant_id, status, operation, data, compensation_operation, compensation_data, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        operation.participantId,
        'pending',
        operation.operation,
        JSON.stringify(operation.data),
        operation.compensationOperation || '',
        JSON.stringify(operation.compensationData || {}),
        new Date()
      ],
      { prepare: true }
    );
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus
  ): Promise<void> {
    await this.client.execute(
      `UPDATE ${this.keyspace}.${this.config.coordinatorTable} 
       SET status = ? WHERE transaction_id = ?`,
      [status, transactionId],
      { prepare: true }
    );
  }

  private async updateParticipantStatus(
    transactionId: string,
    participantId: string,
    status: string
  ): Promise<void> {
    await this.client.execute(
      `UPDATE ${this.keyspace}.${this.config.participantTable} 
       SET status = ? WHERE transaction_id = ? AND participant_id = ?`,
      [status, transactionId, participantId],
      { prepare: true }
    );
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionContext | null> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.coordinatorTable} 
       WHERE transaction_id = ?`,
      [transactionId],
      { prepare: true }
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      transactionId: row.transaction_id,
      coordinatorId: row.coordinator_id,
      participants: row.participants,
      status: row.status as TransactionStatus,
      startTime: row.start_time,
      timeout: row.timeout,
      metadata: row.metadata
    };
  }

  async getParticipantOperations(transactionId: string): Promise<TransactionOperation[]> {
    const result = await this.client.execute(
      `SELECT * FROM ${this.keyspace}.${this.config.participantTable} 
       WHERE transaction_id = ?`,
      [transactionId],
      { prepare: true }
    );

    return result.rows.map(row => ({
      participantId: row.participant_id,
      operation: row.operation,
      data: JSON.parse(row.data),
      compensationOperation: row.compensation_operation || undefined,
      compensationData: row.compensation_data ? JSON.parse(row.compensation_data) : undefined
    }));
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Example participant implementation
export class CassandraParticipant implements TransactionParticipant {
  constructor(
    public id: string,
    private client: Client,
    private keyspace: string
  ) {}

  async prepare(): Promise<boolean> {
    try {
      // Check if the operation can be performed
      // This is a simplified implementation
      return true;
    } catch (error) {
      return false;
    }
  }

  async commit(): Promise<void> {
    // Execute the actual operation
    // This would contain the actual business logic
  }

  async abort(): Promise<void> {
    // Rollback any changes made during prepare
    // This would contain compensation logic
  }
}

// Two-Phase Commit implementation
export class TwoPhaseCommitCoordinator extends DistributedTransactionManager {
  async executeTwoPhaseCommit(
    coordinatorId: string,
    operations: TransactionOperation[]
  ): Promise<string> {
    const transactionId = await this.beginTransaction(coordinatorId, operations);
    
    try {
      await this.executeTransaction(transactionId);
      return transactionId;
    } catch (error) {
      this.emit('twoPhaseCommitFailed', { transactionId, error });
      throw error;
    }
  }
}

// Saga implementation for long-running transactions
export class SagaCoordinator extends EventEmitter {
  private steps: SagaStep[] = [];
  private compensations: SagaStep[] = [];

  constructor(private sagaId: string) {
    super();
  }

  addStep(step: SagaStep, compensation?: SagaStep): this {
    this.steps.push(step);
    if (compensation) {
      this.compensations.unshift(compensation); // Reverse order
    }
    return this;
  }

  async execute(): Promise<void> {
    this.emit('sagaStarted', { sagaId: this.sagaId });
    
    let completedSteps = 0;

    try {
      for (let i = 0; i < this.steps.length; i++) {
        await this.steps[i].execute();
        completedSteps++;
        this.emit('sagaStepCompleted', { sagaId: this.sagaId, step: i });
      }

      this.emit('sagaCompleted', { sagaId: this.sagaId });
    } catch (error) {
      this.emit('sagaFailed', { sagaId: this.sagaId, step: completedSteps, error });
      
      // Execute compensations for completed steps
      for (let i = 0; i < completedSteps && i < this.compensations.length; i++) {
        try {
          await this.compensations[i].execute();
          this.emit('sagaCompensationCompleted', { sagaId: this.sagaId, step: i });
        } catch (compensationError) {
          this.emit('sagaCompensationFailed', { sagaId: this.sagaId, step: i, error: compensationError });
        }
      }

      throw error;
    }
  }
}

export interface SagaStep {
  execute(): Promise<void>;
}
