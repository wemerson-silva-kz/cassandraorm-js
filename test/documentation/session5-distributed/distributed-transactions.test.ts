import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 5: Distributed Transactions', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Two-Phase Commit Simulation', () => {
    it('should implement 2PC protocol', async () => {
      class TwoPhaseCommitCoordinator {
        private participants = new Map();
        private transactions = new Map();

        addParticipant(participantId: string, participant: any) {
          this.participants.set(participantId, participant);
        }

        async beginTransaction(transactionId: string, operations: any[]) {
          this.transactions.set(transactionId, {
            id: transactionId,
            operations,
            status: 'preparing',
            participants: new Set(),
            preparedParticipants: new Set(),
            startTime: new Date()
          });

          return transactionId;
        }

        async prepare(transactionId: string) {
          const transaction = this.transactions.get(transactionId);
          if (!transaction) throw new Error('Transaction not found');

          const prepareResults = [];
          
          // Phase 1: Prepare all participants
          for (const operation of transaction.operations) {
            const participant = this.participants.get(operation.service);
            if (participant) {
              try {
                const result = await participant.prepare(operation);
                prepareResults.push({ service: operation.service, result, status: 'prepared' });
                transaction.preparedParticipants.add(operation.service);
              } catch (error) {
                prepareResults.push({ service: operation.service, error, status: 'failed' });
              }
            }
          }

          // Check if all participants prepared successfully
          const allPrepared = prepareResults.every(r => r.status === 'prepared');
          transaction.status = allPrepared ? 'prepared' : 'prepare_failed';

          return { allPrepared, results: prepareResults };
        }

        async commit(transactionId: string) {
          const transaction = this.transactions.get(transactionId);
          if (!transaction || transaction.status !== 'prepared') {
            throw new Error('Transaction not prepared');
          }

          const commitResults = [];
          
          // Phase 2: Commit all participants
          for (const participantId of transaction.preparedParticipants) {
            const participant = this.participants.get(participantId);
            if (participant) {
              try {
                await participant.commit(transactionId);
                commitResults.push({ service: participantId, status: 'committed' });
              } catch (error) {
                commitResults.push({ service: participantId, error, status: 'commit_failed' });
              }
            }
          }

          transaction.status = 'committed';
          return commitResults;
        }

        async rollback(transactionId: string) {
          const transaction = this.transactions.get(transactionId);
          if (!transaction) throw new Error('Transaction not found');

          const rollbackResults = [];
          
          for (const participantId of transaction.preparedParticipants) {
            const participant = this.participants.get(participantId);
            if (participant) {
              try {
                await participant.rollback(transactionId);
                rollbackResults.push({ service: participantId, status: 'rolled_back' });
              } catch (error) {
                rollbackResults.push({ service: participantId, error, status: 'rollback_failed' });
              }
            }
          }

          transaction.status = 'rolled_back';
          return rollbackResults;
        }
      }

      // Mock participants
      const mockParticipant = {
        prepare: async (operation: any) => {
          if (operation.shouldFail) {
            throw new Error('Prepare failed');
          }
          return { prepared: true };
        },
        commit: async (transactionId: string) => {
          return { committed: true };
        },
        rollback: async (transactionId: string) => {
          return { rolledBack: true };
        }
      };

      const coordinator = new TwoPhaseCommitCoordinator();
      coordinator.addParticipant('service1', mockParticipant);
      coordinator.addParticipant('service2', mockParticipant);

      // Test successful transaction
      const txId = await coordinator.beginTransaction('tx1', [
        { service: 'service1', operation: 'update_inventory' },
        { service: 'service2', operation: 'process_payment' }
      ]);

      const prepareResult = await coordinator.prepare(txId);
      expect(prepareResult.allPrepared).toBe(true);

      const commitResult = await coordinator.commit(txId);
      expect(commitResult.every(r => r.status === 'committed')).toBe(true);
    });
  });

  describe('Saga Pattern Implementation', () => {
    it('should implement saga with compensation', async () => {
      class SagaOrchestrator {
        private sagas = new Map();

        async executeSaga(sagaId: string, steps: any[]) {
          const saga = {
            id: sagaId,
            steps,
            currentStep: 0,
            completedSteps: [],
            status: 'running',
            startTime: new Date()
          };

          this.sagas.set(sagaId, saga);

          try {
            for (let i = 0; i < steps.length; i++) {
              const step = steps[i];
              saga.currentStep = i;

              // Execute step
              const result = await step.action();
              saga.completedSteps.push({
                stepIndex: i,
                stepName: step.name,
                result,
                completedAt: new Date()
              });
            }

            saga.status = 'completed';
            return saga;

          } catch (error) {
            saga.status = 'failed';
            (saga as any).error = error;

            // Execute compensations in reverse order
            await this.compensate(sagaId);
            throw error;
          }
        }

        async compensate(sagaId: string) {
          const saga = this.sagas.get(sagaId);
          if (!saga) return;

          const compensationResults = [];

          // Compensate completed steps in reverse order
          for (let i = saga.completedSteps.length - 1; i >= 0; i--) {
            const completedStep = saga.completedSteps[i];
            const step = saga.steps[completedStep.stepIndex];

            if (step.compensation) {
              try {
                await step.compensation();
                compensationResults.push({
                  stepName: step.name,
                  status: 'compensated'
                });
              } catch (error) {
                compensationResults.push({
                  stepName: step.name,
                  status: 'compensation_failed',
                  error
                });
              }
            }
          }

          saga.compensationResults = compensationResults;
          saga.status = 'compensated';
          return compensationResults;
        }

        getSaga(sagaId: string) {
          return this.sagas.get(sagaId);
        }
      }

      const orchestrator = new SagaOrchestrator();
      
      let step1Executed = false;
      let step2Executed = false;
      let step1Compensated = false;

      const sagaSteps = [
        {
          name: 'step1',
          action: async () => {
            step1Executed = true;
            return { success: true };
          },
          compensation: async () => {
            step1Compensated = true;
          }
        },
        {
          name: 'step2',
          action: async () => {
            step2Executed = true;
            throw new Error('Step 2 failed');
          },
          compensation: async () => {
            // No compensation needed for failed step
          }
        }
      ];

      // Test saga with failure and compensation
      try {
        await orchestrator.executeSaga('saga1', sagaSteps);
      } catch (error) {
        expect(error.message).toBe('Step 2 failed');
      }

      const saga = orchestrator.getSaga('saga1');
      expect(step1Executed).toBe(true);
      expect(step2Executed).toBe(true);
      expect(step1Compensated).toBe(true);
      expect(saga.status).toBe('compensated');
    });
  });

  describe('Distributed Lock Manager', () => {
    it('should manage distributed locks', async () => {
      class DistributedLockManager {
        private locks = new Map();
        private lockTimeouts = new Map();

        async acquireLock(resource: string, ownerId: string, ttl: number = 30000) {
          const now = Date.now();
          const existingLock = this.locks.get(resource);

          // Check if lock exists and is not expired
          if (existingLock && now < existingLock.expiresAt) {
            if (existingLock.ownerId === ownerId) {
              // Extend existing lock
              existingLock.expiresAt = now + ttl;
              return { acquired: true, extended: true };
            } else {
              return { acquired: false, reason: 'locked_by_other' };
            }
          }

          // Acquire new lock
          const lock = {
            resource,
            ownerId,
            acquiredAt: now,
            expiresAt: now + ttl
          };

          this.locks.set(resource, lock);

          // Set timeout for automatic release
          const timeoutId = setTimeout(() => {
            this.releaseLock(resource, ownerId);
          }, ttl);
          this.lockTimeouts.set(resource, timeoutId);

          return { acquired: true, lock };
        }

        async releaseLock(resource: string, ownerId: string) {
          const lock = this.locks.get(resource);
          
          if (!lock) {
            return { released: false, reason: 'lock_not_found' };
          }

          if (lock.ownerId !== ownerId) {
            return { released: false, reason: 'not_owner' };
          }

          this.locks.delete(resource);
          
          const timeoutId = this.lockTimeouts.get(resource);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.lockTimeouts.delete(resource);
          }

          return { released: true };
        }

        isLocked(resource: string): boolean {
          const lock = this.locks.get(resource);
          return !!(lock && Date.now() < lock.expiresAt);
        }

        getLockInfo(resource: string) {
          const lock = this.locks.get(resource);
          if (!lock) return null;

          return {
            ...lock,
            isExpired: Date.now() >= lock.expiresAt,
            remainingTtl: Math.max(0, lock.expiresAt - Date.now())
          };
        }
      }

      const lockManager = new DistributedLockManager();

      // Test lock acquisition
      const result1 = await lockManager.acquireLock('resource1', 'owner1', 1000);
      expect(result1.acquired).toBe(true);

      // Test lock conflict
      const result2 = await lockManager.acquireLock('resource1', 'owner2', 1000);
      expect(result2.acquired).toBe(false);
      expect(result2.reason).toBe('locked_by_other');

      // Test lock extension
      const result3 = await lockManager.acquireLock('resource1', 'owner1', 2000);
      expect(result3.acquired).toBe(true);
      expect(result3.extended).toBe(true);

      // Test lock release
      const releaseResult = await lockManager.releaseLock('resource1', 'owner1');
      expect(releaseResult.released).toBe(true);

      // Test lock after release
      expect(lockManager.isLocked('resource1')).toBe(false);
    });
  });

  describe('Eventual Consistency Manager', () => {
    it('should handle eventual consistency reconciliation', async () => {
      class EventualConsistencyManager {
        private inconsistencies = [];
        private reconciliationRules = new Map();

        addReconciliationRule(name: string, rule: any) {
          this.reconciliationRules.set(name, rule);
        }

        async detectInconsistencies() {
          const inconsistencies = [];

          for (const [name, rule] of this.reconciliationRules.entries()) {
            try {
              const isConsistent = await rule.check();
              if (!isConsistent) {
                inconsistencies.push({
                  rule: name,
                  detectedAt: new Date(),
                  status: 'detected'
                });
              }
            } catch (error) {
              inconsistencies.push({
                rule: name,
                detectedAt: new Date(),
                status: 'check_failed',
                error
              });
            }
          }

          this.inconsistencies = inconsistencies;
          return inconsistencies;
        }

        async reconcile() {
          const reconciliationResults = [];

          for (const inconsistency of this.inconsistencies) {
            if (inconsistency.status === 'detected') {
              const rule = this.reconciliationRules.get(inconsistency.rule);
              
              try {
                await rule.reconcile();
                reconciliationResults.push({
                  rule: inconsistency.rule,
                  status: 'reconciled',
                  reconciledAt: new Date()
                });
              } catch (error) {
                reconciliationResults.push({
                  rule: inconsistency.rule,
                  status: 'reconciliation_failed',
                  error
                });
              }
            }
          }

          return reconciliationResults;
        }

        getInconsistencies() {
          return this.inconsistencies;
        }
      }

      const consistencyManager = new EventualConsistencyManager();

      let isConsistent = true;
      let reconciled = false;

      // Add reconciliation rule
      consistencyManager.addReconciliationRule('test_consistency', {
        check: async () => {
          return isConsistent;
        },
        reconcile: async () => {
          reconciled = true;
          isConsistent = true;
        }
      });

      // Test consistency check when consistent
      let inconsistencies = await consistencyManager.detectInconsistencies();
      expect(inconsistencies).toHaveLength(0);

      // Simulate inconsistency
      isConsistent = false;
      inconsistencies = await consistencyManager.detectInconsistencies();
      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0].rule).toBe('test_consistency');

      // Test reconciliation
      const reconciliationResults = await consistencyManager.reconcile();
      expect(reconciliationResults).toHaveLength(1);
      expect(reconciliationResults[0].status).toBe('reconciled');
      expect(reconciled).toBe(true);
    });
  });
});
