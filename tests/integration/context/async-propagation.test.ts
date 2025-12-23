/**
 * @file Context Propagation Integration Tests
 * @description Validates AsyncLocalStorage propagates context across async boundaries
 * 
 * WHY THIS MATTERS FOR HEXAGONAL ARCHITECTURE:
 * - Request context (traceId, userId) must flow through all layers
 * - No need to pass context as parameters (reduces coupling)
 * - AsyncLocalStorage enables "ambient context" pattern
 * 
 * CRITICAL GUARANTEES:
 * ✅ Context available in Promise.then() chains
 * ✅ Context available in Promise.all() parallel operations
 * ✅ Context available in setTimeout/setImmediate
 * ✅ Context available in nested async functions
 * ✅ Context isolated between concurrent requests
 */

import { describe, it, expect } from '@jest/globals';
import { RequestContext } from '../../../src/index';

describe('Context Propagation - AsyncLocalStorage', () => {
  // ============================================================================
  // TEST GROUP 1: Promise Chain Propagation
  // ============================================================================

  describe('Promise Chain Propagation', () => {
    it('should propagate context through Promise.then() chain', async () => {
      let capturedTraceId: string | undefined;
      let capturedUserId: string | undefined;

      await RequestContext.run(
        {
          traceId: 'trace-abc-123',
          userId: 'user-456',
        },
        async () => {
          await Promise.resolve()
            .then(() => {
              const ctx = RequestContext.current();
              capturedTraceId = ctx?.get('traceId');
              capturedUserId = ctx?.get('userId');
            })
            .then(() => {
              // Context still available in second then()
              const ctx = RequestContext.current();
              expect(ctx?.get('traceId')).toBe('trace-abc-123');
              expect(ctx?.get('userId')).toBe('user-456');
            });
        }
      );

      expect(capturedTraceId).toBe('trace-abc-123');
      expect(capturedUserId).toBe('user-456');
    });

    it('should propagate context through multiple promise chains', async () => {
      const capturedValues: (string | undefined)[] = [];

      await RequestContext.run({ traceId: 'trace-xyz' }, async () => {
        await Promise.resolve()
          .then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
            return Promise.resolve('step1');
          })
          .then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
            return Promise.resolve('step2');
          })
          .then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
            return Promise.resolve('step3');
          });
      });

      expect(capturedValues).toEqual(['trace-xyz', 'trace-xyz', 'trace-xyz']);
    });

    it('should propagate context through async/await', async () => {
      let captured1: string | undefined;
      let captured2: string | undefined;
      let captured3: string | undefined;

      await RequestContext.run({ traceId: 'trace-async' }, async () => {
        // First async operation
        captured1 = RequestContext.current()?.get('traceId');

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Second async operation
        captured2 = RequestContext.current()?.get('traceId');

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Third async operation
        captured3 = RequestContext.current()?.get('traceId');
      });

      expect(captured1).toBe('trace-async');
      expect(captured2).toBe('trace-async');
      expect(captured3).toBe('trace-async');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Parallel Operations (Promise.all)
  // ============================================================================

  describe('Parallel Operations - Promise.all()', () => {
    it('should propagate context to all parallel operations', async () => {
      const capturedValues: (string | undefined)[] = [];

      await RequestContext.run({ traceId: 'trace-parallel' }, async () => {
        await Promise.all([
          Promise.resolve().then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
          }),
          Promise.resolve().then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
          }),
          Promise.resolve().then(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));
          }),
        ]);
      });

      expect(capturedValues).toHaveLength(3);
      expect(capturedValues.every((v) => v === 'trace-parallel')).toBe(true);
    });

    it('should propagate context in Promise.all with delays', async () => {
      const capturedValues: (string | undefined)[] = [];

      await RequestContext.run({ traceId: 'trace-delayed' }, async () => {
        await Promise.all([
          new Promise<void>((resolve) =>
            setTimeout(() => {
              capturedValues.push(RequestContext.current()?.get('traceId'));
              resolve();
            }, 50)
          ),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              capturedValues.push(RequestContext.current()?.get('traceId'));
              resolve();
            }, 30)
          ),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              capturedValues.push(RequestContext.current()?.get('traceId'));
              resolve();
            }, 10)
          ),
        ]);
      });

      expect(capturedValues).toHaveLength(3);
      expect(capturedValues.every((v) => v === 'trace-delayed')).toBe(true);
    });

    it('should propagate context in Promise.race', async () => {
      let capturedValue: string | undefined;

      await RequestContext.run({ traceId: 'trace-race' }, async () => {
        await Promise.race([
          new Promise<void>((resolve) =>
            setTimeout(() => {
              capturedValue = RequestContext.current()?.get('traceId');
              resolve();
            }, 10)
          ),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              resolve();
            }, 50)
          ),
        ]);
      });

      expect(capturedValue).toBe('trace-race');
    });
  });

  // ============================================================================
  // TEST GROUP 3: Timer Functions (setTimeout, setImmediate)
  // ============================================================================

  describe('Timer Functions', () => {
    it('should propagate context through setTimeout', async () => {
      let capturedValue: string | undefined;

      await RequestContext.run({ traceId: 'trace-timeout' }, async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            capturedValue = RequestContext.current()?.get('traceId');
            resolve();
          }, 50);
        });
      });

      expect(capturedValue).toBe('trace-timeout');
    });

    it('should propagate context through setImmediate', async () => {
      let capturedValue: string | undefined;

      await RequestContext.run({ traceId: 'trace-immediate' }, async () => {
        await new Promise<void>((resolve) => {
          setImmediate(() => {
            capturedValue = RequestContext.current()?.get('traceId');
            resolve();
          });
        });
      });

      expect(capturedValue).toBe('trace-immediate');
    });

    it('should propagate context through nested setTimeouts', async () => {
      const capturedValues: (string | undefined)[] = [];

      await RequestContext.run({ traceId: 'trace-nested-timeout' }, async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            capturedValues.push(RequestContext.current()?.get('traceId'));

            setTimeout(() => {
              capturedValues.push(RequestContext.current()?.get('traceId'));

              setTimeout(() => {
                capturedValues.push(RequestContext.current()?.get('traceId'));
                resolve();
              }, 10);
            }, 10);
          }, 10);
        });
      });

      expect(capturedValues).toHaveLength(3);
      expect(capturedValues.every((v) => v === 'trace-nested-timeout')).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 4: Nested Async Functions
  // ============================================================================

  describe('Nested Async Functions', () => {
    it('should propagate context through nested async calls', async () => {
      const capturedValues: (string | undefined)[] = [];

      async function level3() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedValues.push(RequestContext.current()?.get('traceId'));
      }

      async function level2() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedValues.push(RequestContext.current()?.get('traceId'));
        await level3();
      }

      async function level1() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedValues.push(RequestContext.current()?.get('traceId'));
        await level2();
      }

      await RequestContext.run({ traceId: 'trace-nested' }, async () => {
        await level1();
      });

      expect(capturedValues).toHaveLength(3);
      expect(capturedValues.every((v) => v === 'trace-nested')).toBe(true);
    });

    it('should propagate multiple context values through nested calls', async () => {
      type CapturedContext = {
        traceId?: string;
        userId?: string;
        requestId?: string;
      };

      const capturedContexts: CapturedContext[] = [];

      async function processOrder() {
        const ctx = RequestContext.current();
        capturedContexts.push({
          traceId: ctx?.get('traceId'),
          userId: ctx?.get('userId'),
          requestId: ctx?.get('requestId'),
        });
      }

      async function validateUser() {
        const ctx = RequestContext.current();
        capturedContexts.push({
          traceId: ctx?.get('traceId'),
          userId: ctx?.get('userId'),
          requestId: ctx?.get('requestId'),
        });
        await processOrder();
      }

      await RequestContext.run(
        {
          traceId: 'trace-123',
          userId: 'user-456',
          requestId: 'req-789',
        },
        async () => {
          await validateUser();
        }
      );

      expect(capturedContexts).toHaveLength(2);
      capturedContexts.forEach((ctx) => {
        expect(ctx.traceId).toBe('trace-123');
        expect(ctx.userId).toBe('user-456');
        expect(ctx.requestId).toBe('req-789');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 5: Context Isolation (Concurrent Requests)
  // ============================================================================

  describe('Context Isolation - Concurrent Requests', () => {
    it('should isolate context between concurrent requests', async () => {
      const results: Array<{ requestId: string; traceId: string | undefined }> = [];

      // Simulate 3 concurrent requests
      await Promise.all([
        RequestContext.run({ traceId: 'trace-request-1' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          results.push({
            requestId: 'request-1',
            traceId: RequestContext.current()?.get('traceId'),
          });
        }),
        RequestContext.run({ traceId: 'trace-request-2' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          results.push({
            requestId: 'request-2',
            traceId: RequestContext.current()?.get('traceId'),
          });
        }),
        RequestContext.run({ traceId: 'trace-request-3' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push({
            requestId: 'request-3',
            traceId: RequestContext.current()?.get('traceId'),
          });
        }),
      ]);

      // Each request should have its own isolated context
      expect(results).toHaveLength(3);

      const req1 = results.find((r) => r.requestId === 'request-1');
      const req2 = results.find((r) => r.requestId === 'request-2');
      const req3 = results.find((r) => r.requestId === 'request-3');

      expect(req1?.traceId).toBe('trace-request-1');
      expect(req2?.traceId).toBe('trace-request-2');
      expect(req3?.traceId).toBe('trace-request-3');
    });

    it('should handle 100 concurrent requests with isolated contexts', async () => {
      const results: Array<{ index: number; traceId: string | undefined }> = [];

      const promises = Array.from({ length: 100 }, (_, i) =>
        RequestContext.run({ traceId: `trace-${i}` }, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
          results.push({
            index: i,
            traceId: RequestContext.current()?.get('traceId'),
          });
        })
      );

      await Promise.all(promises);

      expect(results).toHaveLength(100);

      // Each request should have its own trace ID
      for (let i = 0; i < 100; i++) {
        const result = results.find((r) => r.index === i);
        expect(result?.traceId).toBe(`trace-${i}`);
      }
    });
  });

  // ============================================================================
  // TEST GROUP 6: Nested Context Scopes
  // ============================================================================

  describe('Nested Context Scopes', () => {
    it('should allow nested context scopes with independent values', async () => {
      let outerTraceId: string | undefined;
      let innerTraceId: string | undefined;
      let restoredTraceId: string | undefined;

      await RequestContext.run({ traceId: 'outer-trace' }, async () => {
        outerTraceId = RequestContext.current()?.get('traceId');

        await RequestContext.run({ traceId: 'inner-trace' }, async () => {
          innerTraceId = RequestContext.current()?.get('traceId');
        });

        // Outer context should be restored
        restoredTraceId = RequestContext.current()?.get('traceId');
      });

      expect(outerTraceId).toBe('outer-trace');
      expect(innerTraceId).toBe('inner-trace');
      expect(restoredTraceId).toBe('outer-trace');
    });

    it('should handle deeply nested context scopes', async () => {
      const capturedValues: (string | undefined)[] = [];

      await RequestContext.run({ level: 'level-1' }, async () => {
        capturedValues.push(RequestContext.current()?.get('level'));

        await RequestContext.run({ level: 'level-2' }, async () => {
          capturedValues.push(RequestContext.current()?.get('level'));

          await RequestContext.run({ level: 'level-3' }, async () => {
            capturedValues.push(RequestContext.current()?.get('level'));

            await RequestContext.run({ level: 'level-4' }, async () => {
              capturedValues.push(RequestContext.current()?.get('level'));
            });

            capturedValues.push(RequestContext.current()?.get('level'));
          });

          capturedValues.push(RequestContext.current()?.get('level'));
        });

        capturedValues.push(RequestContext.current()?.get('level'));
      });

      expect(capturedValues).toEqual([
        'level-1',
        'level-2',
        'level-3',
        'level-4',
        'level-3', // Restored
        'level-2', // Restored
        'level-1', // Restored
      ]);
    });
  });

  // ============================================================================
  // TEST GROUP 7: Context Outside Scope
  // ============================================================================

  describe('Context Outside Scope', () => {
    it('should return null when accessing context outside RequestContext.run()', () => {
      const ctx = RequestContext.current();
      expect(ctx).toBeUndefined();
    });

    it('should return null after context scope ends', async () => {
      await RequestContext.run({ traceId: 'trace-temp' }, async () => {
        expect(RequestContext.current()).not.toBeNull();
      });

      // Outside scope now
      const ctx = RequestContext.current();
      expect(ctx).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST GROUP 8: Real-World HTTP Request Simulation
  // ============================================================================

  describe('Real-World HTTP Request Simulation', () => {
    it('should simulate complete HTTP request flow with context propagation', async () => {
      // Simulate HTTP middleware
      const httpMiddleware = async (
        requestId: string,
        userId: string,
        handler: () => Promise<any>
      ) => {
        return await RequestContext.run(
          {
            traceId: `trace-${requestId}`,
            userId,
            requestId,
            ip: '192.168.1.100',
          },
          handler
        );
      };

      // Simulate application service
      const orderService = {
        async createOrder(customerId: string, total: number) {
          // Service can access context without passing it
          const ctx = RequestContext.current();
          const traceId = ctx?.get('traceId');
          const userId = ctx?.get('userId');

          // Simulate async operations
          await new Promise((resolve) => setTimeout(resolve, 10));

          return {
            orderId: `order-${Date.now()}`,
            customerId,
            total,
            traceId,
            userId,
          };
        },
      };

      // Execute request
      const result = await httpMiddleware('req-123', 'user-456', async () => {
        return await orderService.createOrder('customer-789', 99.99);
      });

      // Verify context was propagated throughout
      expect(result.traceId).toBe('trace-req-123');
      expect(result.userId).toBe('user-456');
      expect(result.customerId).toBe('customer-789');
    });

    it('should simulate multiple concurrent HTTP requests', async () => {
      const requests = [
        { requestId: 'req-1', userId: 'user-1', delay: 50 },
        { requestId: 'req-2', userId: 'user-2', delay: 30 },
        { requestId: 'req-3', userId: 'user-3', delay: 10 },
      ];

      const results = await Promise.all(
        requests.map(({ requestId, userId, delay }) =>
          RequestContext.run({ requestId, userId }, async () => {
            await new Promise((resolve) => setTimeout(resolve, delay));

            const ctx = RequestContext.current();
            return {
              requestId: ctx?.get('requestId'),
              userId: ctx?.get('userId'),
            };
          })
        )
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ requestId: 'req-1', userId: 'user-1' });
      expect(results[1]).toEqual({ requestId: 'req-2', userId: 'user-2' });
      expect(results[2]).toEqual({ requestId: 'req-3', userId: 'user-3' });
    });
  });
});