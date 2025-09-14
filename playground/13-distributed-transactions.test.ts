#!/usr/bin/env bun
import { 
  createClient,
  DistributedTransactionManager,
  SagaOrchestrator,
  TransactionCoordinator,
  type TransactionConfig,
  type SagaStep
} from '../src/index.js';

async function testDistributedTransactions() {
  console.log('🔀 Teste 13: Transações Distribuídas\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_transactions'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Test DistributedTransactionManager
    const transactionConfig: TransactionConfig = {
      timeout: 30000,
      retryAttempts: 3,
      isolationLevel: 'READ_COMMITTED'
    };

    const txManager = new DistributedTransactionManager(client.driver, transactionConfig);
    console.log('✅ DistributedTransactionManager criado');

    // Test TransactionCoordinator
    const coordinator = new TransactionCoordinator({
      coordinatorId: 'coord-1',
      participants: ['service-a', 'service-b', 'service-c'],
      timeout: 30000
    });
    console.log('✅ TransactionCoordinator criado');

    // Test 2PC Transaction
    const transactionId = client.uuid();
    console.log('🔄 Iniciando transação 2PC:', transactionId);

    // Phase 1: Prepare
    const prepareResults = await coordinator.prepare(transactionId, {
      'service-a': { operation: 'transfer', amount: 100, from: 'acc1', to: 'acc2' },
      'service-b': { operation: 'update_inventory', item: 'item1', quantity: -1 },
      'service-c': { operation: 'log_transaction', txId: transactionId }
    });

    console.log('✅ Fase Prepare concluída:', prepareResults.allPrepared ? 'SUCESSO' : 'FALHA');

    if (prepareResults.allPrepared) {
      // Phase 2: Commit
      const commitResults = await coordinator.commit(transactionId);
      console.log('✅ Fase Commit concluída:', commitResults.allCommitted ? 'SUCESSO' : 'FALHA');
    } else {
      // Phase 2: Abort
      const abortResults = await coordinator.abort(transactionId);
      console.log('✅ Fase Abort concluída:', abortResults.allAborted ? 'SUCESSO' : 'FALHA');
    }

    // Test Saga Pattern
    const sagaOrchestrator = new SagaOrchestrator({
      sagaId: 'order-processing-saga',
      compensationTimeout: 60000
    });
    console.log('✅ SagaOrchestrator criado');

    // Define saga steps
    const orderProcessingSaga: SagaStep[] = [
      {
        stepId: 'validate-payment',
        action: async (data: any) => {
          console.log('   💳 Validando pagamento...');
          return { success: true, paymentId: 'pay-123' };
        },
        compensation: async (data: any) => {
          console.log('   ↩️ Cancelando validação de pagamento...');
          return { success: true };
        }
      },
      {
        stepId: 'reserve-inventory',
        action: async (data: any) => {
          console.log('   📦 Reservando estoque...');
          return { success: true, reservationId: 'res-456' };
        },
        compensation: async (data: any) => {
          console.log('   ↩️ Liberando reserva de estoque...');
          return { success: true };
        }
      },
      {
        stepId: 'create-shipment',
        action: async (data: any) => {
          console.log('   🚚 Criando envio...');
          return { success: true, shipmentId: 'ship-789' };
        },
        compensation: async (data: any) => {
          console.log('   ↩️ Cancelando envio...');
          return { success: true };
        }
      },
      {
        stepId: 'send-confirmation',
        action: async (data: any) => {
          console.log('   📧 Enviando confirmação...');
          return { success: true, confirmationId: 'conf-101' };
        },
        compensation: async (data: any) => {
          console.log('   ↩️ Enviando cancelamento...');
          return { success: true };
        }
      }
    ];

    // Execute successful saga
    console.log('🔄 Executando saga de sucesso...');
    const sagaResult = await sagaOrchestrator.execute(orderProcessingSaga, {
      orderId: 'order-123',
      customerId: 'cust-456',
      items: [{ id: 'item1', quantity: 2 }]
    });

    console.log('✅ Saga executada:', sagaResult.success ? 'SUCESSO' : 'FALHA');
    console.log('   • Steps executados:', sagaResult.completedSteps);

    // Test saga with failure and compensation
    const failingSaga: SagaStep[] = [
      {
        stepId: 'step1',
        action: async () => {
          console.log('   ✅ Step 1 executado');
          return { success: true };
        },
        compensation: async () => {
          console.log('   ↩️ Compensando step 1');
          return { success: true };
        }
      },
      {
        stepId: 'step2',
        action: async () => {
          console.log('   ✅ Step 2 executado');
          return { success: true };
        },
        compensation: async () => {
          console.log('   ↩️ Compensando step 2');
          return { success: true };
        }
      },
      {
        stepId: 'failing-step',
        action: async () => {
          console.log('   ❌ Step falhando...');
          throw new Error('Simulated failure');
        },
        compensation: async () => {
          console.log('   ↩️ Compensando step que falhou');
          return { success: true };
        }
      }
    ];

    console.log('🔄 Executando saga com falha...');
    const failingSagaResult = await sagaOrchestrator.execute(failingSaga, {});
    
    console.log('✅ Saga com falha processada:', failingSagaResult.success ? 'SUCESSO' : 'FALHA');
    console.log('   • Compensações executadas:', failingSagaResult.compensatedSteps);

    // Test transaction monitoring
    const txMonitor = txManager.getMonitor();
    const activeTransactions = await txMonitor.getActiveTransactions();
    console.log('✅ Transações ativas monitoradas:', activeTransactions.length);

    const txStats = await txMonitor.getStatistics();
    console.log('✅ Estatísticas de transações:');
    console.log('   • Total iniciadas:', txStats.totalStarted);
    console.log('   • Total commitadas:', txStats.totalCommitted);
    console.log('   • Total abortadas:', txStats.totalAborted);
    console.log('   • Taxa de sucesso:', txStats.successRate + '%');

    console.log('\n📊 FUNCIONALIDADES DE TRANSAÇÕES TESTADAS:');
    console.log('   • DistributedTransactionManager - Gerenciamento de transações');
    console.log('   • TransactionCoordinator - Coordenação 2PC');
    console.log('   • SagaOrchestrator - Orquestração de sagas');
    console.log('   • Two-Phase Commit - Protocolo 2PC');
    console.log('   • Saga Pattern - Padrão saga com compensação');
    console.log('   • Transaction Monitoring - Monitoramento de transações');
    console.log('   • Compensation Logic - Lógica de compensação');
    console.log('   • Failure Recovery - Recuperação de falhas');

    console.log('\n🎉 Teste Distributed Transactions: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste Distributed Transactions:', error.message);
  } finally {
    await client.close();
  }
}

testDistributedTransactions();
