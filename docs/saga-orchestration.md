# Saga Orchestration

## Overview
Advanced saga orchestration for managing complex distributed workflows with compensation, parallel execution, and state management.

## Saga Manager Setup

```typescript
import { SagaManager } from 'cassandraorm-js';

const sagaManager = new SagaManager(client, {
  sagaTable: 'sagas',
  stateTable: 'saga_states',
  compensationTable: 'saga_compensations',
  timeout: 300000, // 5 minutes
  retryPolicy: {
    maxRetries: 3,
    backoff: 'exponential'
  }
});

await sagaManager.initialize();
```

## Basic Saga Definition

```typescript
import { Saga, SagaStep } from 'cassandraorm-js';

class OrderProcessingSaga extends Saga {
  constructor() {
    super('order_processing');
  }

  define(): SagaStep[] {
    return [
      {
        name: 'validate_payment',
        action: this.validatePayment,
        compensation: this.releasePayment,
        timeout: 30000
      },
      {
        name: 'reserve_inventory',
        action: this.reserveInventory,
        compensation: this.unreserveInventory,
        timeout: 15000
      },
      {
        name: 'create_order',
        action: this.createOrder,
        compensation: this.cancelOrder,
        timeout: 10000
      },
      {
        name: 'charge_payment',
        action: this.chargePayment,
        compensation: this.refundPayment,
        timeout: 30000
      },
      {
        name: 'update_inventory',
        action: this.updateInventory,
        compensation: this.restoreInventory,
        timeout: 10000
      }
    ];
  }

  async validatePayment(context: any): Promise<any> {
    const result = await paymentService.validate({
      cardToken: context.paymentInfo.cardToken,
      amount: context.orderTotal
    });
    
    return { paymentId: result.paymentId, valid: result.valid };
  }

  async releasePayment(context: any, stepResult: any): Promise<void> {
    if (stepResult?.paymentId) {
      await paymentService.release(stepResult.paymentId);
    }
  }

  async reserveInventory(context: any): Promise<any> {
    const reservations = [];
    
    for (const item of context.orderItems) {
      const reservation = await inventoryService.reserve({
        productId: item.productId,
        quantity: item.quantity
      });
      reservations.push(reservation);
    }
    
    return { reservations };
  }

  async unreserveInventory(context: any, stepResult: any): Promise<void> {
    if (stepResult?.reservations) {
      for (const reservation of stepResult.reservations) {
        await inventoryService.unreserve(reservation.id);
      }
    }
  }

  // ... other step implementations
}
```

## Parallel Saga Execution

```typescript
class ParallelOrderProcessingSaga extends Saga {
  define(): SagaStep[] {
    return [
      {
        name: 'validate_customer',
        action: this.validateCustomer,
        compensation: this.invalidateCustomer
      },
      {
        name: 'parallel_processing',
        type: 'parallel',
        steps: [
          {
            name: 'process_payment',
            action: this.processPayment,
            compensation: this.refundPayment
          },
          {
            name: 'reserve_inventory',
            action: this.reserveInventory,
            compensation: this.unreserveInventory
          },
          {
            name: 'calculate_shipping',
            action: this.calculateShipping,
            compensation: this.cancelShipping
          }
        ]
      },
      {
        name: 'create_order',
        action: this.createOrder,
        compensation: this.cancelOrder,
        dependsOn: ['parallel_processing']
      }
    ];
  }
}
```

## Conditional Saga Steps

```typescript
class ConditionalSaga extends Saga {
  define(): SagaStep[] {
    return [
      {
        name: 'check_customer_tier',
        action: this.checkCustomerTier
      },
      {
        name: 'apply_premium_discount',
        action: this.applyPremiumDiscount,
        compensation: this.removePremiumDiscount,
        condition: (context, previousResults) => {
          return previousResults.check_customer_tier?.tier === 'premium';
        }
      },
      {
        name: 'apply_standard_discount',
        action: this.applyStandardDiscount,
        compensation: this.removeStandardDiscount,
        condition: (context, previousResults) => {
          return previousResults.check_customer_tier?.tier === 'standard';
        }
      }
    ];
  }
}
```

## Saga State Management

```typescript
import { SagaState } from 'cassandraorm-js';

class StatefulSaga extends Saga {
  async executeStep(stepName: string, context: any, state: SagaState): Promise<any> {
    // Access saga state
    const previousAttempts = state.get('attempts', 0);
    
    if (previousAttempts >= 3) {
      throw new Error('Maximum attempts exceeded');
    }
    
    try {
      const result = await super.executeStep(stepName, context, state);
      
      // Update state on success
      state.set('last_successful_step', stepName);
      state.set('attempts', 0);
      
      return result;
    } catch (error) {
      // Update state on failure
      state.set('attempts', previousAttempts + 1);
      state.set('last_error', error.message);
      throw error;
    }
  }
}
```

## Saga Orchestrator

```typescript
import { SagaOrchestrator } from 'cassandraorm-js';

const orchestrator = new SagaOrchestrator(sagaManager, {
  maxConcurrentSagas: 100,
  heartbeatInterval: 30000,
  stateCheckInterval: 60000
});

// Register saga types
orchestrator.registerSaga('order_processing', OrderProcessingSaga);
orchestrator.registerSaga('user_onboarding', UserOnboardingSaga);
orchestrator.registerSaga('payment_processing', PaymentProcessingSaga);

// Start saga
const sagaId = await orchestrator.startSaga('order_processing', {
  orderId: '12345',
  customerId: 'cust_789',
  orderItems: [
    { productId: 'prod_1', quantity: 2, price: 29.99 },
    { productId: 'prod_2', quantity: 1, price: 49.99 }
  ],
  paymentInfo: {
    cardToken: 'tok_123456',
    billingAddress: { /* ... */ }
  }
});

console.log(`Started saga: ${sagaId}`);
```

## Saga Monitoring and Recovery

```typescript
import { SagaMonitor } from 'cassandraorm-js';

const monitor = new SagaMonitor(sagaManager, {
  checkInterval: 30000,
  timeoutThreshold: 300000,
  failureThreshold: 5
});

// Monitor saga health
monitor.on('sagaTimeout', async (sagaId) => {
  console.log(`Saga ${sagaId} timed out`);
  await orchestrator.compensateSaga(sagaId);
});

monitor.on('sagaFailed', async (sagaId, error) => {
  console.log(`Saga ${sagaId} failed:`, error);
  
  // Attempt recovery
  const saga = await sagaManager.getSaga(sagaId);
  if (saga.canRecover()) {
    await orchestrator.recoverSaga(sagaId);
  } else {
    await orchestrator.compensateSaga(sagaId);
  }
});

// Get saga statistics
const stats = await monitor.getStatistics();
console.log(`Active sagas: ${stats.activeSagas}`);
console.log(`Completed sagas: ${stats.completedSagas}`);
console.log(`Failed sagas: ${stats.failedSagas}`);
```

## Saga Compensation Strategies

```typescript
class AdvancedCompensationSaga extends Saga {
  define(): SagaStep[] {
    return [
      {
        name: 'step1',
        action: this.step1Action,
        compensation: this.step1Compensation,
        compensationStrategy: 'immediate' // Compensate immediately on failure
      },
      {
        name: 'step2',
        action: this.step2Action,
        compensation: this.step2Compensation,
        compensationStrategy: 'deferred' // Compensate only if saga fails
      },
      {
        name: 'step3',
        action: this.step3Action,
        compensation: this.step3Compensation,
        compensationStrategy: 'conditional', // Compensate based on condition
        compensationCondition: (context, error) => {
          return error.code === 'BUSINESS_RULE_VIOLATION';
        }
      }
    ];
  }

  // Custom compensation order
  getCompensationOrder(): string[] {
    return ['step3', 'step1', 'step2']; // Reverse order with custom logic
  }
}
```

## Saga Event Integration

```typescript
import { SagaEventHandler } from 'cassandraorm-js';

class EventDrivenSaga extends Saga {
  constructor() {
    super('event_driven_saga');
    this.eventHandler = new SagaEventHandler(this);
  }

  define(): SagaStep[] {
    return [
      {
        name: 'initiate_process',
        action: this.initiateProcess
      },
      {
        name: 'wait_for_approval',
        type: 'wait_for_event',
        event: 'approval_received',
        timeout: 86400000 // 24 hours
      },
      {
        name: 'complete_process',
        action: this.completeProcess,
        dependsOn: ['wait_for_approval']
      }
    ];
  }

  async handleEvent(eventType: string, eventData: any, sagaId: string): Promise<void> {
    if (eventType === 'approval_received') {
      await this.resumeSaga(sagaId, 'wait_for_approval', eventData);
    } else if (eventType === 'approval_rejected') {
      await this.compensateSaga(sagaId);
    }
  }
}

// Event publishing
await eventBus.publish('approval_received', {
  sagaId: sagaId,
  approvalId: 'approval_123',
  approved: true
});
```

## Saga Testing

```typescript
import { SagaTestRunner } from 'cassandraorm-js';

describe('OrderProcessingSaga', () => {
  let testRunner: SagaTestRunner;
  let saga: OrderProcessingSaga;

  beforeEach(() => {
    testRunner = new SagaTestRunner();
    saga = new OrderProcessingSaga();
  });

  it('should complete successfully with valid input', async () => {
    const context = {
      orderId: '12345',
      paymentInfo: { cardToken: 'valid_token' },
      orderItems: [{ productId: 'prod_1', quantity: 1 }]
    };

    const result = await testRunner.runSaga(saga, context);
    
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toHaveLength(5);
  });

  it('should compensate on payment failure', async () => {
    // Mock payment service to fail
    testRunner.mockService('paymentService', {
      validate: () => { throw new Error('Payment failed'); }
    });

    const context = { /* ... */ };
    const result = await testRunner.runSaga(saga, context);
    
    expect(result.status).toBe('compensated');
    expect(result.compensatedSteps).toContain('validate_payment');
  });
});
```
