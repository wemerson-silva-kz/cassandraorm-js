# Distributed Transactions

## Overview
Distributed transaction management with Two-Phase Commit (2PC), Saga patterns, and eventual consistency guarantees.

## Two-Phase Commit (2PC)

```typescript
import { TransactionCoordinator } from 'cassandraorm-js';

const coordinator = new TransactionCoordinator(client, {
  timeout: 30000,
  retryAttempts: 3,
  coordinatorTable: 'transaction_log'
});

// Execute distributed transaction
const transactionId = await coordinator.begin({
  participants: ['users_service', 'orders_service', 'inventory_service']
});

try {
  // Phase 1: Prepare
  await coordinator.prepare(transactionId, [
    {
      service: 'users_service',
      operation: 'debit_account',
      params: { userId: '123', amount: 100 }
    },
    {
      service: 'orders_service', 
      operation: 'create_order',
      params: { userId: '123', productId: '456', quantity: 2 }
    },
    {
      service: 'inventory_service',
      operation: 'reserve_items',
      params: { productId: '456', quantity: 2 }
    }
  ]);

  // Phase 2: Commit
  await coordinator.commit(transactionId);
  
} catch (error) {
  // Rollback on failure
  await coordinator.rollback(transactionId);
  throw error;
}
```

## Saga Pattern Implementation

```typescript
import { SagaOrchestrator } from 'cassandraorm-js';

const sagaOrchestrator = new SagaOrchestrator(client);

// Define saga steps with compensations
const orderProcessingSaga = sagaOrchestrator.createSaga('order_processing', [
  {
    name: 'validate_payment',
    action: async (context) => {
      return await paymentService.validate(context.paymentInfo);
    },
    compensation: async (context) => {
      await paymentService.release(context.paymentInfo);
    }
  },
  {
    name: 'reserve_inventory',
    action: async (context) => {
      return await inventoryService.reserve(context.items);
    },
    compensation: async (context) => {
      await inventoryService.unreserve(context.items);
    }
  },
  {
    name: 'create_order',
    action: async (context) => {
      return await orderService.create(context.orderData);
    },
    compensation: async (context) => {
      await orderService.cancel(context.orderId);
    }
  },
  {
    name: 'charge_payment',
    action: async (context) => {
      return await paymentService.charge(context.paymentInfo);
    },
    compensation: async (context) => {
      await paymentService.refund(context.chargeId);
    }
  }
]);

// Execute saga
const sagaId = await orderProcessingSaga.execute({
  paymentInfo: { cardToken: 'token123', amount: 100 },
  items: [{ productId: '456', quantity: 2 }],
  orderData: { userId: '123', total: 100 }
});
```

## Distributed Lock Manager

```typescript
import { DistributedLockManager } from 'cassandraorm-js';

const lockManager = new DistributedLockManager(client, {
  lockTable: 'distributed_locks',
  defaultTTL: 30000,
  retryInterval: 1000
});

// Acquire distributed lock
const lock = await lockManager.acquire('inventory:product:456', {
  ttl: 60000,
  waitTimeout: 10000
});

try {
  // Critical section - only one process can execute this
  const currentStock = await getProductStock('456');
  if (currentStock >= requestedQuantity) {
    await updateProductStock('456', currentStock - requestedQuantity);
  } else {
    throw new Error('Insufficient stock');
  }
} finally {
  await lock.release();
}
```

## Eventual Consistency Manager

```typescript
import { EventualConsistencyManager } from 'cassandraorm-js';

const consistencyManager = new EventualConsistencyManager(client, {
  reconciliationInterval: 60000,
  maxInconsistencyWindow: 300000
});

// Define consistency rules
await consistencyManager.addRule('user_balance_consistency', {
  tables: ['user_accounts', 'transaction_log'],
  reconciliation: async () => {
    const accounts = await client.execute('SELECT user_id, balance FROM user_accounts');
    
    for (const account of accounts.rows) {
      const transactions = await client.execute(
        'SELECT SUM(amount) as total FROM transaction_log WHERE user_id = ?',
        [account.user_id]
      );
      
      const expectedBalance = transactions.rows[0].total || 0;
      
      if (account.balance !== expectedBalance) {
        await client.execute(
          'UPDATE user_accounts SET balance = ? WHERE user_id = ?',
          [expectedBalance, account.user_id]
        );
        
        console.log(`Reconciled balance for user ${account.user_id}`);
      }
    }
  }
});

await consistencyManager.start();
```

## Distributed State Machine

```typescript
import { DistributedStateMachine } from 'cassandraorm-js';

const orderStateMachine = new DistributedStateMachine(client, 'order_states', {
  states: ['pending', 'validated', 'processing', 'shipped', 'delivered', 'cancelled'],
  transitions: {
    pending: ['validated', 'cancelled'],
    validated: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
  }
});

// Transition state across distributed system
await orderStateMachine.transition('order:123', 'pending', 'validated', {
  validator: async (orderId, fromState, toState) => {
    // Validate transition is allowed
    const order = await getOrder(orderId);
    return order.paymentStatus === 'confirmed';
  },
  onTransition: async (orderId, fromState, toState) => {
    // Notify other services
    await eventBus.publish('order_state_changed', {
      orderId,
      fromState,
      toState,
      timestamp: new Date()
    });
  }
});
```

## Consensus Algorithm (Raft)

```typescript
import { RaftConsensus } from 'cassandraorm-js';

const raftNode = new RaftConsensus(client, {
  nodeId: 'node-1',
  peers: ['node-2', 'node-3'],
  electionTimeout: 5000,
  heartbeatInterval: 1000
});

// Propose value to cluster
const proposal = await raftNode.propose({
  operation: 'update_config',
  data: { maxConnections: 1000 }
});

if (proposal.committed) {
  console.log('Configuration update committed across cluster');
} else {
  console.log('Failed to reach consensus');
}

// Handle leadership changes
raftNode.on('becameLeader', () => {
  console.log('This node became the leader');
});

raftNode.on('becameFollower', (leaderId) => {
  console.log(`Following leader: ${leaderId}`);
});
```

## Cross-Datacenter Transactions

```typescript
import { CrossDCTransactionManager } from 'cassandraorm-js';

const crossDCManager = new CrossDCTransactionManager({
  datacenters: [
    { name: 'us-east', client: usEastClient },
    { name: 'us-west', client: usWestClient },
    { name: 'eu-west', client: euWestClient }
  ],
  consistencyLevel: 'EACH_QUORUM'
});

// Execute transaction across datacenters
await crossDCManager.executeTransaction(async (clients) => {
  // Write to US East
  await clients['us-east'].execute(
    'INSERT INTO user_events (id, user_id, event) VALUES (?, ?, ?)',
    [uuid(), userId, 'login']
  );
  
  // Write to US West (replica)
  await clients['us-west'].execute(
    'INSERT INTO user_events (id, user_id, event) VALUES (?, ?, ?)',
    [uuid(), userId, 'login']
  );
  
  // Update EU West counter
  await clients['eu-west'].execute(
    'UPDATE global_counters SET count = count + 1 WHERE metric = ?',
    ['user_logins']
  );
});
```

## Transaction Recovery

```typescript
import { TransactionRecoveryManager } from 'cassandraorm-js';

const recoveryManager = new TransactionRecoveryManager(client, {
  recoveryTable: 'transaction_recovery',
  checkInterval: 30000
});

// Automatic recovery of failed transactions
await recoveryManager.enableAutoRecovery({
  maxAge: 300000, // 5 minutes
  maxRetries: 3,
  strategies: {
    '2pc': async (transaction) => {
      // Recover 2PC transaction
      if (transaction.phase === 'prepare') {
        await coordinator.rollback(transaction.id);
      } else if (transaction.phase === 'commit') {
        await coordinator.commit(transaction.id);
      }
    },
    'saga': async (transaction) => {
      // Recover saga transaction
      const saga = await sagaOrchestrator.getSaga(transaction.sagaId);
      await saga.recover();
    }
  }
});

// Manual recovery
const failedTransactions = await recoveryManager.getFailedTransactions();
for (const transaction of failedTransactions) {
  try {
    await recoveryManager.recover(transaction.id);
  } catch (error) {
    console.error(`Failed to recover transaction ${transaction.id}:`, error);
  }
}
```
