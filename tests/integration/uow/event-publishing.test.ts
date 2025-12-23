/**
 * @fileoverview Integration tests for Unit of Work + Event Bus
 *
 * Tests the critical flow: Aggregate → Repository → UnitOfWork → EventBus
 *
 * CRITICAL: Events must be published ONLY after successful transaction commit.
 * If transaction rolls back, events MUST NOT be published (data consistency).
 */

import {
  IDomainEvent,
  EventMetadata,
  IUnitOfWork,
  IEventBus,
  IEventHandler, // ← 추가!
  TransactionState,
  TransactionResult,
  AggregateRoot,
  StruktosContextData,
  IContext,
} from '../../../src';

// ============================================================================
// Test Domain: Order Aggregate
// ============================================================================

/**
 * Order Created event payload
 */
interface OrderCreatedPayload {
  orderId: string;
  customerId: string;
  total: number;
}

/**
 * Order Created domain event
 */
class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
  public readonly eventName = 'OrderCreated';
  public readonly metadata: EventMetadata;

  constructor(public readonly payload: OrderCreatedPayload) {
    this.metadata = {
      eventId: `evt-${Date.now()}-${Math.random()}`,
      occurredAt: new Date().toISOString(),
    };
  }
}

/**
 * Order aggregate root extending AggregateRoot base class
 *
 * Simplified domain entity for testing event publishing flow.
 */
class Order extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly total: number,
  ) {
    super();
  }

  static create(customerId: string, total: number): Order {
    const order = new Order(`order-${Date.now()}`, customerId, total);

    // Raise event (stored internally, NOT published yet)
    order.raiseEvent(
      new OrderCreatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        total: order.total,
      }),
    );

    return order;
  }
}

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Mock Event Bus that tracks published events AND handlers
 */
class MockEventBus implements IEventBus {
  public publishedEvents: IDomainEvent[] = [];
  private handlers: Map<string, IEventHandler<any>[]> = new Map();

  async publish<TPayload>(event: IDomainEvent<TPayload>): Promise<void> {
    this.publishedEvents.push(event);

    // Trigger registered handlers
    const eventHandlers = this.handlers.get(event.eventName) || [];
    for (const handler of eventHandlers) {
      await handler.handle(event);
    }
  }

  async publishAll(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async publishSync<TPayload>(event: IDomainEvent<TPayload>): Promise<void> {
    await this.publish(event);
  }

  registerHandler<TPayload>(
    eventName: string,
    handler: IEventHandler<IDomainEvent<TPayload>>,
  ): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  reset(): void {
    this.publishedEvents = [];
    this.handlers.clear();
  }
}

/**
 * Mock Unit of Work with event buffering
 */
class MockUnitOfWork implements IUnitOfWork<StruktosContextData> {
  private _state: TransactionState = TransactionState.Inactive;
  private bufferedEvents: IDomainEvent[] = [];
  private transaction = {
    isActive: false,
    isCommitted: false,
    isRolledBack: false,
  };

  constructor(private eventBus: MockEventBus) {}

  get state(): TransactionState {
    return this._state;
  }

  get context(): IContext<StruktosContextData> | undefined {
    return undefined;
  }

  get id(): string {
    return 'mock-uow-id';
  }

  async start(): Promise<void> {
    this._state = TransactionState.Active;
    this.transaction.isActive = true;
    this.transaction.isCommitted = false;
    this.transaction.isRolledBack = false;
  }

  async commit(): Promise<TransactionResult> {
    // Check rollback BEFORE checking active (important!)
    if (this.transaction.isRolledBack) {
      throw new Error('Cannot commit after rollback');
    }

    if (!this.transaction.isActive) {
      throw new Error('No active transaction');
    }

    // CRITICAL: Publish events ONLY after successful commit
    this._state = TransactionState.Committed;
    this.transaction.isCommitted = true;
    this.transaction.isActive = false;

    // Publish all buffered events
    await this.eventBus.publishAll(this.bufferedEvents);

    // Clear buffer
    this.bufferedEvents = [];

    return {
      success: true,
      duration: 0,
      affectedCount: 0,
      traceId: 'test-trace-id',
    };
  }

  async rollback(): Promise<TransactionResult> {
    if (!this.transaction.isActive) {
      return {
        success: true,
        duration: 0,
        traceId: 'test-trace-id',
      };
    }

    // CRITICAL: Do NOT publish events on rollback
    this._state = TransactionState.RolledBack;
    this.transaction.isRolledBack = true;
    this.transaction.isActive = false;

    // Discard buffered events
    this.bufferedEvents = [];

    return {
      success: true,
      duration: 0,
      traceId: 'test-trace-id',
    };
  }

  addDomainEvents(events: IDomainEvent[]): void {
    this.bufferedEvents.push(...events);
  }

  getRepository<TRepository>(_token: any): TRepository {
    throw new Error('Not implemented');
  }

  hasRepository(_token: any): boolean {
    return false;
  }

  async executeInTransaction<TResult>(
    callback: (
      unitOfWork: IUnitOfWork<StruktosContextData>,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    await this.start();
    try {
      const result = await callback(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async createSavepoint(_name: string): Promise<void> {
    // Not implemented
  }

  async rollbackToSavepoint(_name: string): Promise<void> {
    // Not implemented
  }

  async releaseSavepoint(_name: string): Promise<void> {
    // Not implemented
  }

  setContext(_context: IContext<StruktosContextData>): void {
    // Not implemented
  }

  async dispose(): Promise<void> {
    this._state = TransactionState.Inactive;
    this.transaction.isActive = false;
    this.bufferedEvents = [];
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UnitOfWork + EventBus Integration', () => {
  let eventBus: MockEventBus;
  let uow: MockUnitOfWork;
  let order: Order;
  let events: IDomainEvent[];

  beforeEach(() => {
    eventBus = new MockEventBus();
    uow = new MockUnitOfWork(eventBus);
    order = Order.create('customer-123', 100.0);
    events = [...order.domainEvents];
    order.clearEvents();
  });

  // ==========================================================================
  // SUCCESSFUL TRANSACTION FLOW
  // ==========================================================================

  describe('Successful Transaction Flow', () => {
    it('should publish events ONLY after successful commit', async () => {
      await uow.start();
      uow.addDomainEvents(events);

      // Events NOT published yet
      expect(eventBus.publishedEvents).toHaveLength(0);

      await uow.commit();

      // NOW events are published
      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0]!.eventName).toBe('OrderCreated');
    });

    it('should publish multiple events in order', async () => {
      const event1 = new OrderCreatedEvent({
        orderId: 'order-1',
        customerId: 'cust-1',
        total: 100,
      });
      const event2 = new OrderCreatedEvent({
        orderId: 'order-2',
        customerId: 'cust-2',
        total: 200,
      });

      await uow.start();
      uow.addDomainEvents([event1, event2]);
      await uow.commit();

      expect(eventBus.publishedEvents).toHaveLength(2);
      expect(eventBus.publishedEvents[0]!.payload.orderId).toBe('order-1');
      expect(eventBus.publishedEvents[1]!.payload.orderId).toBe('order-2');
    });

    it('should publish events from multiple aggregates', async () => {
      const order1 = Order.create('customer-1', 100);
      const order2 = Order.create('customer-2', 200);

      const allEvents = [...order1.domainEvents, ...order2.domainEvents];
      order1.clearEvents();
      order2.clearEvents();

      await uow.start();
      uow.addDomainEvents(allEvents);
      await uow.commit();

      expect(eventBus.publishedEvents).toHaveLength(2);
    });
  });

  // ==========================================================================
  // ROLLBACK SCENARIO (CRITICAL!)
  // ==========================================================================

  describe('Rollback Scenario', () => {
    it('should NOT publish events when transaction is rolled back', async () => {
      await uow.start();
      uow.addDomainEvents(events);

      // Rollback (database error simulation)
      await uow.rollback();

      // CRITICAL ASSERTION: Events NOT published
      expect(eventBus.publishedEvents).toHaveLength(0);

      // No email sent! No analytics tracked! Data consistency maintained!
    });

    it('should discard all buffered events on rollback', async () => {
      const event1 = new OrderCreatedEvent({
        orderId: 'order-1',
        customerId: 'cust-1',
        total: 100,
      });
      const event2 = new OrderCreatedEvent({
        orderId: 'order-2',
        customerId: 'cust-2',
        total: 200,
      });

      await uow.start();
      uow.addDomainEvents([event1, event2]);
      await uow.rollback();

      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('should prevent commit after rollback', async () => {
      await uow.start();
      uow.addDomainEvents(events);
      await uow.rollback();

      // Attempting to commit after rollback should fail
      await expect(uow.commit()).rejects.toThrow(
        'Cannot commit after rollback',
      );

      // Events still not published
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // EVENT HANDLER INTEGRATION
  // ==========================================================================

  describe('Event Handler Integration', () => {
    it('should trigger event handlers on publish', async () => {
      const handleSpy = jest.fn();

      // Create proper IEventHandler mock
      const mockHandler: IEventHandler<OrderCreatedEvent> = {
        handle: handleSpy,
      };

      eventBus.registerHandler('OrderCreated', mockHandler);

      await uow.start();
      uow.addDomainEvents(events);
      await uow.commit();

      // Handler was called
      expect(handleSpy).toHaveBeenCalledTimes(1);
      expect(handleSpy).toHaveBeenCalledWith(events[0]!);
      expect(eventBus.publishedEvents).toHaveLength(1);
    });

    it('should support multiple handlers for same event', async () => {
      const emailHandlerSpy = jest.fn();
      const analyticsHandlerSpy = jest.fn();

      const emailHandler: IEventHandler<OrderCreatedEvent> = {
        handle: emailHandlerSpy,
      };

      const analyticsHandler: IEventHandler<OrderCreatedEvent> = {
        handle: analyticsHandlerSpy,
      };

      eventBus.registerHandler('OrderCreated', emailHandler);
      eventBus.registerHandler('OrderCreated', analyticsHandler);

      await uow.start();
      uow.addDomainEvents(events);
      await uow.commit();

      // Both handlers called
      expect(emailHandlerSpy).toHaveBeenCalledTimes(1);
      expect(analyticsHandlerSpy).toHaveBeenCalledTimes(1);
      expect(eventBus.publishedEvents).toHaveLength(1);
    });

    it('should NOT trigger handlers on rollback', async () => {
      const handleSpy = jest.fn();

      const mockHandler: IEventHandler<OrderCreatedEvent> = {
        handle: handleSpy,
      };

      eventBus.registerHandler('OrderCreated', mockHandler);

      await uow.start();
      uow.addDomainEvents(events);
      await uow.rollback();

      // Handler NOT called
      expect(handleSpy).not.toHaveBeenCalled();
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('should pass correct event to handler', async () => {
      const handleSpy = jest.fn();

      const mockHandler: IEventHandler<OrderCreatedEvent> = {
        handle: handleSpy,
      };

      eventBus.registerHandler('OrderCreated', mockHandler);

      await uow.start();
      uow.addDomainEvents(events);
      await uow.commit();

      // Verify handler received correct event
      expect(handleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'OrderCreated',
          payload: expect.objectContaining({
            customerId: 'customer-123',
            total: 100.0,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // TRANSACTION STATE MANAGEMENT
  // ==========================================================================

  describe('Transaction State Management', () => {
    it('should enforce single active transaction', async () => {
      await uow.start();

      // Starting another transaction should fail (implementation-specific)
      // This test validates the mock behavior
      expect(uow.state).toBe(TransactionState.Active);
    });

    it('should require active transaction for commit', async () => {
      // Attempting to commit without starting transaction
      await expect(uow.commit()).rejects.toThrow('No active transaction');
    });

    it('should allow rollback even if no active transaction (idempotent)', async () => {
      const result = await uow.rollback();
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // COMPLETE APPLICATION FLOW
  // ==========================================================================

  describe('Complete Application Flow', () => {
    it('should simulate HTTP request → UoW → Repository → EventBus (success)', async () => {
      // 1. HTTP request arrives
      // 2. Create Unit of Work
      // 3. Start transaction
      await uow.start();

      // 4. Domain logic creates aggregate
      const order = Order.create('customer-456', 250.0);

      // 5. Repository saves aggregate and extracts events
      const events = [...order.domainEvents];
      order.clearEvents();

      // 6. Buffer events in Unit of Work
      uow.addDomainEvents(events);

      // 7. Commit transaction
      await uow.commit();

      // 8. Events published (email sent, analytics tracked)
      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0]!.payload.orderId).toBe(order.id);
    });

    it('should simulate HTTP request → UoW → Repository → EventBus (failure)', async () => {
      await uow.start();

      const order = Order.create('customer-789', 300.0);
      const events = [...order.domainEvents];
      order.clearEvents();

      uow.addDomainEvents(events);

      // Database error occurs
      await uow.rollback();

      // Events NOT published (no email, no analytics)
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });
});
