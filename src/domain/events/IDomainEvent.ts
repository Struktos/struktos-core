/**
 * @fileoverview Domain Events - Event-Driven Architecture Interfaces
 *
 * @packageDocumentation
 * @module @struktos/core/domain/events
 *
 * ## Hexagonal Architecture Layer: DOMAIN (Core)
 *
 * This file belongs to the **Domain Layer**, which contains core business
 * logic and domain model abstractions.
 *
 * Domain layer:
 * - ✅ **CAN**: Define domain events and event-raising entities
 * - ✅ **CAN**: Express business rules through events
 * - ✅ **CAN**: Raise events internally without knowing how they're published
 * - ❌ **CANNOT**: Depend on infrastructure (IEventBus implementation)
 * - ❌ **CANNOT**: Directly publish events (that's infrastructure's job)
 * - ❌ **CANNOT**: Know about HTTP, databases, or message queues
 *
 * ## Architectural Responsibility
 *
 * This module provides **Domain Events** abstraction inspired by:
 * - Domain-Driven Design (DDD) by Eric Evans
 * - Event Sourcing patterns
 * - CQRS (Command Query Responsibility Segregation)
 *
 * Domain events represent **significant state changes** in the domain:
 *
 * ```
 * Something Happened → Domain Event → Interested Parties React
 * ```
 *
 * ## Why Domain Events?
 *
 * **The Problem Without Events:**
 *
 * ```typescript
 * // ❌ Tightly coupled - business logic scattered everywhere
 * class OrderService {
 *   async createOrder(data: CreateOrderData) {
 *     const order = await orderRepo.create(data);
 *
 *     // All side effects inline - hard to test, hard to maintain
 *     await emailService.sendOrderConfirmation(order);
 *     await inventoryService.reserveStock(order.items);
 *     await paymentService.capturePayment(order.total);
 *     await analyticsService.trackOrderCreated(order);
 *     await notificationService.notifyWarehouse(order);
 *
 *     return order;
 *   }
 * }
 *
 * // Problems:
 * // - OrderService knows too much
 * // - Hard to add new side effects
 * // - Hard to test in isolation
 * // - Transaction boundary unclear
 * ```
 *
 * **The Solution With Events:**
 *
 * ```typescript
 * // ✅ Loosely coupled - separation of concerns
 * class Order extends AggregateRoot {
 *   static create(data: CreateOrderData): Order {
 *     const order = new Order(data);
 *
 *     // Just raise the event - don't worry about handlers
 *     order.raiseEvent(new OrderCreatedEvent({
 *       orderId: order.id,
 *       customerId: order.customerId,
 *       total: order.total,
 *       items: order.items,
 *     }));
 *
 *     return order;
 *   }
 * }
 *
 * // Side effects as independent event handlers
 * class SendOrderConfirmationHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent) {
 *     await emailService.sendConfirmation(event.payload.orderId);
 *   }
 * }
 *
 * class ReserveStockHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent) {
 *     await inventoryService.reserve(event.payload.items);
 *   }
 * }
 *
 * // Benefits:
 * // - Order doesn't know about email, inventory, etc.
 * // - Easy to add new handlers
 * // - Easy to test each handler independently
 * // - Clear transaction boundary (events published after commit)
 * ```
 *
 * ## Domain Purity: Why Entities Don't Publish Directly
 *
 * **Critical Principle:**
 *
 * Entities RAISE events but DON'T PUBLISH them. This keeps the domain pure:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ DOMAIN LAYER (Pure Business Logic)                              │
 * │                                                                  │
 * │  Order.create()                                                  │
 * │    ↓                                                             │
 * │  order.raiseEvent(new OrderCreatedEvent(...))                    │
 * │    ↓                                                             │
 * │  Events stored internally in order.domainEvents[]                │
 * │                                                                  │
 * │  ❌ NO dependency on IEventBus                                   │
 * │  ❌ NO dependency on infrastructure                              │
 * │  ✅ Domain entity remains testable and pure                      │
 * └─────────────────────────────────────────────────────────────────┘
 *          │
 *          │ Repository extracts events
 *          ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ APPLICATION LAYER (Orchestration)                                │
 * │                                                                  │
 * │  const events = aggregate.domainEvents                           │
 * │  aggregate.clearEvents()                                         │
 * └─────────────────────────────────────────────────────────────────┘
 *          │
 *          │ After transaction commit
 *          ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ INFRASTRUCTURE LAYER (Technical Concerns)                        │
 * │                                                                  │
 * │  await eventBus.publishAll(events)                               │
 * │    ↓                                                             │
 * │  Events dispatched to handlers                                   │
 * │  (email service, analytics, etc.)                                │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Event Flow with Unit of Work
 *
 * **Complete Request-to-Response Flow:**
 *
 * ```
 * HTTP Request: POST /api/orders
 *   ↓
 * 1. Request arrives at controller
 *    RequestContext.run({ traceId: 'trace-123' }, async () => {
 *   ↓
 * 2. Create UnitOfWork scope
 *    const scope = provider.createScope();
 *    const uow = scope.getServiceProvider().getService(IUnitOfWork);
 *    await uow.start();
 *   ↓
 * 3. Execute business logic
 *    const order = Order.create(orderData);  // ← Event raised internally
 *    await orderRepo.save(order);  // ← Repository extracts events
 *   ↓
 * 4. Repository extracts events and stores in UoW
 *    class OrderRepository {
 *      async save(order: Order) {
 *        await db.orders.create(order);
 *
 *        // Extract events from aggregate
 *        const events = order.domainEvents;
 *
 *        // Store in UnitOfWork for later publishing
 *        this.uow.addDomainEvents(events);
 *
 *        // Clear events from aggregate
 *        order.clearEvents();
 *      }
 *    }
 *   ↓
 * 5. Commit transaction
 *    await uow.commit();
 *   ↓
 * 6. UnitOfWork publishes events AFTER successful commit
 *    class UnitOfWork {
 *      async commit() {
 *        // Commit database transaction
 *        await this.transaction.commit();
 *
 *        // Publish events ONLY if commit succeeded
 *        await this.eventBus.publishAll(this.domainEvents);
 *
 *        // Clear published events
 *        this.domainEvents = [];
 *      }
 *    }
 *   ↓
 * 7. Event handlers execute
 *    SendOrderConfirmationHandler.handle(OrderCreatedEvent)
 *    ReserveStockHandler.handle(OrderCreatedEvent)
 *    TrackOrderAnalyticsHandler.handle(OrderCreatedEvent)
 *   ↓
 * 8. Cleanup
 *    scope.dispose();
 *    });
 *   ↓
 * HTTP Response: 201 Created
 * ```
 *
 * ## Why Events Are Published AFTER Commit
 *
 * **Transactional Consistency:**
 *
 * Events must only be published if the transaction succeeds:
 *
 * ```typescript
 * // ❌ BAD: Publishing before commit
 * async createOrder(data: CreateOrderData) {
 *   const order = Order.create(data);
 *   await orderRepo.save(order);
 *
 *   // Published BEFORE commit!
 *   await eventBus.publish(new OrderCreatedEvent(order));
 *
 *   await uow.commit();  // What if this fails?
 *   // ← Email already sent but order not saved! Data inconsistency!
 * }
 *
 * // ✅ GOOD: Publishing after commit
 * async createOrder(data: CreateOrderData) {
 *   const order = Order.create(data);
 *   await orderRepo.save(order);  // Events buffered in UoW
 *
 *   await uow.commit();  // Transaction succeeds
 *   // ← UoW publishes events AFTER successful commit
 *   // ← If commit fails, events are never published
 * }
 * ```
 *
 * **Rollback Scenario:**
 *
 * ```
 * Start Transaction
 *   ↓
 * Create Order → Raise OrderCreatedEvent (buffered in UoW)
 *   ↓
 * Reserve Stock → Raise StockReservedEvent (buffered in UoW)
 *   ↓
 * Charge Payment → ERROR! Payment fails
 *   ↓
 * Rollback Transaction
 *   ↓
 * Clear Buffered Events (never published)
 *   ↓
 * No email sent, no analytics tracked ✅
 * ```
 *
 * @see {@link https://martinfowler.com/eaaDev/DomainEvent.html | Martin Fowler - Domain Events}
 * @see {@link https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation | Domain Events Design}
 * @version 1.0.0
 */

/**
 * Interface representing the metadata common to all domain events.
 *
 * @remarks
 * **Event Metadata Principles:**
 *
 * Metadata provides **contextual information** about when and why an event occurred:
 *
 * 1. **eventId**: Unique identifier for event deduplication
 * 2. **occurredAt**: Timestamp for event ordering and debugging
 * 3. **correlationId**: Links related events across services
 * 4. **actorId**: Identifies who triggered the event
 * 5. **context**: Additional request-specific data
 *
 * **Immutability:**
 *
 * Metadata is **immutable** - once set, it never changes:
 *
 * ```typescript
 * const event = new OrderCreatedEvent(payload);
 *
 * // ❌ Cannot modify
 * event.metadata.eventId = 'new-id';  // Error (readonly)
 * event.metadata.occurredAt = new Date().toISOString();  // Error (readonly)
 * ```
 *
 * **Automatic Population:**
 *
 * Metadata is typically populated automatically:
 *
 * ```typescript
 * class DomainEventBase<T> implements IDomainEvent<T> {
 *   public readonly metadata: EventMetadata;
 *
 *   constructor(
 *     public readonly eventName: string,
 *     public readonly payload: T,
 *     metadataOverrides?: Partial<EventMetadata>
 *   ) {
 *     // Automatically populate metadata
 *     this.metadata = {
 *       eventId: metadataOverrides?.eventId || generateUUID(),
 *       occurredAt: metadataOverrides?.occurredAt || new Date().toISOString(),
 *       correlationId: metadataOverrides?.correlationId || getCurrentTraceId(),
 *       actorId: metadataOverrides?.actorId || getCurrentUserId(),
 *       context: metadataOverrides?.context || {},
 *     };
 *   }
 * }
 * ```
 *
 * **Integration with RequestContext:**
 *
 * Metadata can automatically pull from `RequestContext`:
 *
 * ```typescript
 * class OrderCreatedEvent extends DomainEventBase<OrderCreatedPayload> {
 *   constructor(payload: OrderCreatedPayload) {
 *     const ctx = RequestContext.current();
 *
 *     super('OrderCreated', payload, {
 *       correlationId: ctx?.get('traceId'),
 *       actorId: ctx?.get('userId'),
 *       context: {
 *         requestId: ctx?.get('requestId'),
 *         ip: ctx?.get('ip'),
 *       },
 *     });
 *   }
 * }
 * ```
 *
 * @example Complete metadata usage
 * ```typescript
 * const event = new OrderCreatedEvent({
 *   orderId: 'order-123',
 *   customerId: 'customer-456',
 *   total: 99.99,
 * });
 *
 * console.log('Event ID:', event.metadata.eventId);
 * console.log('Occurred at:', event.metadata.occurredAt);
 * console.log('Correlation ID:', event.metadata.correlationId);
 * console.log('Actor ID:', event.metadata.actorId);
 * console.log('Context:', event.metadata.context);
 *
 * // Output:
 * // Event ID: 550e8400-e29b-41d4-a716-446655440000
 * // Occurred at: 2024-12-19T10:30:45.123Z
 * // Correlation ID: trace-abc-123
 * // Actor ID: user-789
 * // Context: { requestId: 'req-xyz', ip: '192.168.1.100' }
 * ```
 */
export interface EventMetadata {
  /**
   * Unique identifier for the event instance.
   *
   * @remarks
   * **Purpose:**
   *
   * Event IDs serve multiple purposes:
   *
   * 1. **Deduplication**: Prevent processing the same event twice
   * 2. **Idempotency**: Make event handlers idempotent
   * 3. **Debugging**: Track specific event instances in logs
   * 4. **Ordering**: Maintain event order in event stores
   *
   * **Format:**
   *
   * Typically a UUID v4:
   *
   * ```typescript
   * import { v4 as uuidv4 } from 'uuid';
   *
   * const eventId = uuidv4();  // '550e8400-e29b-41d4-a716-446655440000'
   * ```
   *
   * **Deduplication Example:**
   *
   * ```typescript
   * class OrderConfirmationHandler implements IEventHandler<OrderCreatedEvent> {
   *   private processedEvents = new Set<string>();
   *
   *   async handle(event: OrderCreatedEvent) {
   *     // Check if already processed
   *     if (this.processedEvents.has(event.metadata.eventId)) {
   *       console.log('Event already processed, skipping');
   *       return;
   *     }
   *
   *     // Process event
   *     await sendEmail(event.payload.customerId);
   *
   *     // Mark as processed
   *     this.processedEvents.add(event.metadata.eventId);
   *   }
   * }
   * ```
   */
  eventId: string;

  /**
   * Timestamp when the event occurred, in ISO 8601 format.
   *
   * @remarks
   * **Purpose:**
   *
   * Timestamps enable:
   *
   * 1. **Event Ordering**: Process events in chronological order
   * 2. **Debugging**: Understand when things happened
   * 3. **Analytics**: Track trends over time
   * 4. **Auditing**: Maintain audit trails
   *
   * **Format:**
   *
   * ISO 8601 string with milliseconds:
   *
   * ```typescript
   * const occurredAt = new Date().toISOString();
   * // '2024-12-19T10:30:45.123Z'
   * ```
   *
   * **Why ISO 8601:**
   *
   * - ✅ Unambiguous (includes timezone)
   * - ✅ Sortable as strings
   * - ✅ Standard across systems
   * - ✅ Easy to parse
   *
   * **Event Ordering Example:**
   *
   * ```typescript
   * // Sort events by occurrence time
   * const sortedEvents = events.sort((a, b) => {
   *   return a.metadata.occurredAt.localeCompare(b.metadata.occurredAt);
   * });
   *
   * // Process in chronological order
   * for (const event of sortedEvents) {
   *   await processEvent(event);
   * }
   * ```
   */
  occurredAt: string;

  /**
   * Optional correlation ID to link related events (e.g., from a single user action).
   *
   * @remarks
   * **Purpose:**
   *
   * Correlation IDs link events that belong to the same logical operation:
   *
   * ```
   * User Action: "Create Order"
   *   ↓
   * correlationId: 'trace-abc-123'
   *   ↓
   * OrderCreatedEvent (correlationId: 'trace-abc-123')
   * StockReservedEvent (correlationId: 'trace-abc-123')
   * PaymentChargedEvent (correlationId: 'trace-abc-123')
   * EmailSentEvent (correlationId: 'trace-abc-123')
   * ```
   *
   * **Integration with RequestContext:**
   *
   * Typically set from `RequestContext.get('traceId')`:
   *
   * ```typescript
   * class DomainEventBase<T> {
   *   constructor(eventName: string, payload: T) {
   *     const ctx = RequestContext.current();
   *
   *     this.metadata = {
   *       eventId: generateUUID(),
   *       occurredAt: new Date().toISOString(),
   *       correlationId: ctx?.get('traceId'),  // ← From RequestContext
   *       // ...
   *     };
   *   }
   * }
   * ```
   *
   * **Distributed Tracing:**
   *
   * Correlation IDs enable distributed tracing across services:
   *
   * ```
   * Service A: OrderService
   *   → OrderCreatedEvent (correlationId: 'trace-123')
   *     ↓
   * Service B: InventoryService
   *   → StockReservedEvent (correlationId: 'trace-123')
   *     ↓
   * Service C: EmailService
   *   → EmailSentEvent (correlationId: 'trace-123')
   * ```
   *
   * All events linked by correlation ID can be queried together:
   *
   * ```typescript
   * // Find all events for a specific request
   * const relatedEvents = await eventStore.query({
   *   correlationId: 'trace-123',
   * });
   * ```
   */
  correlationId?: string;

  /**
   * Optional user or actor ID who triggered the event.
   *
   * @remarks
   * **Purpose:**
   *
   * Actor IDs enable:
   *
   * 1. **Auditing**: Who did what
   * 2. **Authorization**: Verify permissions
   * 3. **User Analytics**: Track user behavior
   * 4. **Personalization**: Tailor responses to specific users
   *
   * **Integration with RequestContext:**
   *
   * Typically set from `RequestContext.get('userId')`:
   *
   * ```typescript
   * const ctx = RequestContext.current();
   *
   * const event = new OrderCreatedEvent(payload, {
   *   actorId: ctx?.get('userId'),  // ← Authenticated user
   * });
   * ```
   *
   * **System vs. User Actions:**
   *
   * ```typescript
   * // User-initiated event
   * const userEvent = new OrderCreatedEvent(payload, {
   *   actorId: 'user-123',  // Specific user
   * });
   *
   * // System-initiated event (background job)
   * const systemEvent = new OrderExpiredEvent(payload, {
   *   actorId: 'system',  // System actor
   * });
   * ```
   *
   * **Audit Trail Example:**
   *
   * ```typescript
   * class AuditLogHandler implements IEventHandler<IDomainEvent> {
   *   async handle(event: IDomainEvent) {
   *     await auditLog.create({
   *       eventName: event.eventName,
   *       actorId: event.metadata.actorId,
   *       occurredAt: event.metadata.occurredAt,
   *       payload: event.payload,
   *     });
   *   }
   * }
   *
   * // Query audit log
   * const userActions = await auditLog.query({
   *   actorId: 'user-123',
   *   startDate: '2024-12-01',
   *   endDate: '2024-12-31',
   * });
   * ```
   */
  actorId?: string;

  /**
   * Optional additional context, such as request ID or tenant ID.
   *
   * @remarks
   * **Purpose:**
   *
   * Context object stores additional request-specific metadata:
   *
   * - **requestId**: Unique request identifier
   * - **tenantId**: Multi-tenant isolation
   * - **ip**: Client IP address
   * - **userAgent**: Client user agent
   * - **locale**: User's locale/language
   * - **Custom fields**: Any domain-specific context
   *
   * **Integration with RequestContext:**
   *
   * ```typescript
   * const ctx = RequestContext.current();
   *
   * const event = new OrderCreatedEvent(payload, {
   *   context: {
   *     requestId: ctx?.get('requestId'),
   *     ip: ctx?.get('ip'),
   *     userAgent: ctx?.get('userAgent'),
   *     tenantId: ctx?.get('tenantId'),
   *   },
   * });
   * ```
   *
   * **Multi-Tenant Example:**
   *
   * ```typescript
   * class OrderCreatedEvent extends DomainEventBase<OrderPayload> {
   *   constructor(payload: OrderPayload) {
   *     const ctx = RequestContext.current();
   *
   *     super('OrderCreated', payload, {
   *       context: {
   *         tenantId: ctx?.get('tenantId'),  // Isolate by tenant
   *       },
   *     });
   *   }
   * }
   *
   * // Event handler respects tenant isolation
   * class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
   *   async handle(event: OrderCreatedEvent) {
   *     const tenantId = event.metadata.context?.tenantId;
   *
   *     // Only access tenant's data
   *     await db.tenants(tenantId).orders.notify(event.payload.orderId);
   *   }
   * }
   * ```
   *
   * **Debugging Example:**
   *
   * ```typescript
   * console.log('Event Context:', event.metadata.context);
   * // {
   * //   requestId: 'req-xyz-789',
   * //   ip: '192.168.1.100',
   * //   userAgent: 'Mozilla/5.0...',
   * //   tenantId: 'tenant-abc',
   * //   customField: 'custom-value'
   * // }
   * ```
   */
  context?: Record<string, any>;
}

/**
 * Interface for a domain event.
 *
 * @template TPayload - The type of the payload carried by the event
 *
 * @remarks
 * **Event Naming Convention:**
 *
 * Event names should be **past tense** (something happened):
 *
 * - ✅ **Good**: `OrderCreated`, `PaymentCharged`, `UserRegistered`
 * - ❌ **Bad**: `CreateOrder`, `ChargePayment`, `RegisterUser`
 *
 * **Event Structure:**
 *
 * Domain events have three parts:
 *
 * 1. **eventName**: Identifies the type of event
 * 2. **metadata**: Contextual information (who, when, where)
 * 3. **payload**: Domain-specific data
 *
 * **Immutability:**
 *
 * All fields are `readonly` - events are **immutable** once created:
 *
 * ```typescript
 * const event = new OrderCreatedEvent(payload);
 *
 * // ❌ Cannot modify
 * event.eventName = 'OrderUpdated';  // Error
 * event.payload.total = 100;  // Error
 * ```
 *
 * **Payload Design:**
 *
 * Payloads should contain **all necessary information**:
 *
 * ```typescript
 * // ✅ GOOD: Self-contained payload
 * interface OrderCreatedPayload {
 *   orderId: string;
 *   customerId: string;
 *   items: OrderItem[];
 *   total: number;
 *   shippingAddress: Address;
 * }
 *
 * // ❌ BAD: Incomplete payload
 * interface OrderCreatedPayload {
 *   orderId: string;  // Handler needs to fetch full order from DB!
 * }
 * ```
 *
 * **Backward Compatibility:**
 *
 * Event schemas should be **backward compatible**:
 *
 * ```typescript
 * // Version 1
 * interface UserRegisteredPayload {
 *   userId: string;
 *   email: string;
 * }
 *
 * // Version 2 (backward compatible - only additions)
 * interface UserRegisteredPayload {
 *   userId: string;
 *   email: string;
 *   phoneNumber?: string;  // ← New optional field
 * }
 * ```
 *
 * @example Complete event implementation
 * ```typescript
 * // 1. Define payload interface
 * interface OrderCreatedPayload {
 *   orderId: string;
 *   customerId: string;
 *   items: Array<{
 *     productId: string;
 *     quantity: number;
 *     price: number;
 *   }>;
 *   total: number;
 *   shippingAddress: {
 *     street: string;
 *     city: string;
 *     country: string;
 *     postalCode: string;
 *   };
 * }
 *
 * // 2. Implement event class
 * class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
 *   public readonly eventName = 'OrderCreated';
 *   public readonly metadata: EventMetadata;
 *   public readonly payload: OrderCreatedPayload;
 *
 *   constructor(
 *     payload: OrderCreatedPayload,
 *     metadataOverrides?: Partial<EventMetadata>
 *   ) {
 *     this.payload = payload;
 *
 *     // Auto-populate metadata
 *     const ctx = RequestContext.current();
 *     this.metadata = {
 *       eventId: metadataOverrides?.eventId || generateUUID(),
 *       occurredAt: metadataOverrides?.occurredAt || new Date().toISOString(),
 *       correlationId: metadataOverrides?.correlationId || ctx?.get('traceId'),
 *       actorId: metadataOverrides?.actorId || ctx?.get('userId'),
 *       context: metadataOverrides?.context || {
 *         requestId: ctx?.get('requestId'),
 *       },
 *     };
 *   }
 * }
 *
 * // 3. Raise event from aggregate
 * class Order extends AggregateRoot {
 *   static create(data: CreateOrderData): Order {
 *     const order = new Order(data);
 *
 *     // Raise domain event
 *     order.raiseEvent(new OrderCreatedEvent({
 *       orderId: order.id,
 *       customerId: order.customerId,
 *       items: order.items,
 *       total: order.total,
 *       shippingAddress: order.shippingAddress,
 *     }));
 *
 *     return order;
 *   }
 * }
 * ```
 *
 * @example Event serialization
 * ```typescript
 * const event = new OrderCreatedEvent(payload);
 *
 * // Serialize to JSON for storage
 * const json = JSON.stringify({
 *   eventName: event.eventName,
 *   metadata: event.metadata,
 *   payload: event.payload,
 * });
 *
 * // Deserialize from JSON
 * const data = JSON.parse(json);
 * const reconstructed = new OrderCreatedEvent(data.payload, data.metadata);
 * ```
 */
export interface IDomainEvent<TPayload = any> {
  /**
   * The name of the event, used for routing and handling.
   *
   * @remarks
   * **Naming Convention:**
   *
   * - Use **PascalCase**: `OrderCreated`, not `order_created`
   * - Use **past tense**: `UserRegistered`, not `RegisterUser`
   * - Be **specific**: `PaymentCharged`, not `PaymentProcessed`
   *
   * **Event Routing:**
   *
   * Event name is used to route events to handlers:
   *
   * ```typescript
   * class EventBus {
   *   private handlers = new Map<string, IEventHandler<any>[]>();
   *
   *   registerHandler(eventName: string, handler: IEventHandler<any>) {
   *     if (!this.handlers.has(eventName)) {
   *       this.handlers.set(eventName, []);
   *     }
   *     this.handlers.get(eventName)!.push(handler);
   *   }
   *
   *   async publish(event: IDomainEvent) {
   *     const handlers = this.handlers.get(event.eventName) || [];
   *
   *     for (const handler of handlers) {
   *       await handler.handle(event);
   *     }
   *   }
   * }
   * ```
   *
   * **Event Versioning:**
   *
   * Include version in event name for breaking changes:
   *
   * ```typescript
   * // Original event
   * const event1 = { eventName: 'OrderCreated', ... };
   *
   * // Breaking change - new version
   * const event2 = { eventName: 'OrderCreated.v2', ... };
   * ```
   */
  readonly eventName: string;

  /**
   * Standard metadata associated with the event.
   *
   * @remarks
   * See {@link EventMetadata} for detailed information about metadata fields.
   *
   * **Readonly Enforcement:**
   *
   * Metadata is deeply readonly - no modifications allowed:
   *
   * ```typescript
   * const event = new OrderCreatedEvent(payload);
   *
   * // ❌ All attempts to modify will fail
   * event.metadata.eventId = 'new-id';
   * event.metadata.occurredAt = new Date().toISOString();
   * event.metadata.context.newField = 'value';
   * ```
   */
  readonly metadata: EventMetadata;

  /**
   * The payload containing domain-specific data.
   *
   * @remarks
   * **Payload Guidelines:**
   *
   * 1. **Self-Contained**: Include all necessary data
   * 2. **Immutable**: Never modify after creation
   * 3. **Serializable**: Must be JSON-serializable
   * 4. **Backward Compatible**: Only add optional fields in new versions
   *
   * **What to Include:**
   *
   * ```typescript
   * // ✅ GOOD: Complete, self-contained
   * interface OrderCreatedPayload {
   *   orderId: string;
   *   customerId: string;
   *   customerEmail: string;  // Included for email handler
   *   items: OrderItem[];
   *   total: number;
   *   currency: string;
   * }
   *
   * // ❌ BAD: Incomplete, requires DB lookup
   * interface OrderCreatedPayload {
   *   orderId: string;  // Handler must fetch order from DB
   * }
   * ```
   *
   * **Sensitive Data:**
   *
   * Be careful with sensitive data in events:
   *
   * ```typescript
   * // ⚠️ WARNING: Events may be logged/stored
   * interface PaymentChargedPayload {
   *   orderId: string;
   *   amount: number;
   *   last4Digits: string;  // ✅ OK: Last 4 digits only
   *   cardNumber: string;  // ❌ BAD: Never include full card number!
   * }
   * ```
   */
  readonly payload: TPayload;
}

/**
 * Mixin interface for domain entities/aggregates that raise domain events internally.
 *
 * @remarks
 * **The Aggregate Root Pattern:**
 *
 * In Domain-Driven Design, **Aggregate Roots** are entities that:
 *
 * 1. Guard invariants (business rules)
 * 2. Raise domain events when state changes
 * 3. Collect events internally without publishing them
 *
 * ```
 * ┌─────────────────────────────────────┐
 * │ AggregateRoot (Domain Entity)        │
 * │                                      │
 * │ Private state: Order                 │
 * │ Invariants: total > 0, items > 0     │
 * │                                      │
 * │ Methods:                             │
 * │  - create()                          │
 * │  - addItem()                         │
 * │  - cancel()                          │
 * │                                      │
 * │ Events (internal array):             │
 * │  [OrderCreated, ItemAdded, ...]      │
 * └─────────────────────────────────────┘
 * ```
 *
 * **Why Events Are Internal:**
 *
 * Entities don't publish events directly because:
 *
 * 1. **Domain Purity**: Entities shouldn't depend on infrastructure
 * 2. **Testability**: Can test entity logic without event bus
 * 3. **Transaction Safety**: Events published after DB commit
 * 4. **Flexibility**: Repository decides when to publish
 *
 * **Event Collection Flow:**
 *
 * ```
 * Step 1: Entity raises event
 *   order.raiseEvent(new OrderCreatedEvent(...))
 *     ↓
 *   event added to order.domainEvents[]
 *
 * Step 2: Repository saves entity
 *   await orderRepo.save(order)
 *     ↓
 *   Repository extracts events: order.domainEvents
 *
 * Step 3: Repository stores events in UnitOfWork
 *   uow.addDomainEvents(order.domainEvents)
 *     ↓
 *   order.clearEvents()
 *
 * Step 4: UnitOfWork publishes after commit
 *   await uow.commit()
 *     ↓
 *   await eventBus.publishAll(uow.domainEvents)
 * ```
 *
 * **Base Class Example:**
 *
 * ```typescript
 * abstract class AggregateRoot implements IEventRaisingEntity {
 *   private _domainEvents: IDomainEvent[] = [];
 *
 *   get domainEvents(): readonly IDomainEvent[] {
 *     return this._domainEvents;
 *   }
 *
 *   raiseEvent(event: IDomainEvent): void {
 *     this._domainEvents.push(event);
 *   }
 *
 *   clearEvents(): void {
 *     this._domainEvents = [];
 *   }
 * }
 * ```
 *
 * @example Complete aggregate root implementation
 * ```typescript
 * // Base class
 * abstract class AggregateRoot implements IEventRaisingEntity {
 *   private _domainEvents: IDomainEvent[] = [];
 *
 *   get domainEvents(): readonly IDomainEvent[] {
 *     return this._domainEvents;
 *   }
 *
 *   raiseEvent(event: IDomainEvent): void {
 *     this._domainEvents.push(event);
 *   }
 *
 *   clearEvents(): void {
 *     this._domainEvents = [];
 *   }
 * }
 *
 * // Concrete aggregate
 * class Order extends AggregateRoot {
 *   private constructor(
 *     public readonly id: string,
 *     public readonly customerId: string,
 *     private items: OrderItem[],
 *     private status: OrderStatus
 *   ) {
 *     super();
 *   }
 *
 *   // Factory method raises event
 *   static create(data: CreateOrderData): Order {
 *     const order = new Order(
 *       generateId(),
 *       data.customerId,
 *       data.items,
 *       OrderStatus.Pending
 *     );
 *
 *     // Raise domain event
 *     order.raiseEvent(new OrderCreatedEvent({
 *       orderId: order.id,
 *       customerId: order.customerId,
 *       items: order.items,
 *       total: order.calculateTotal(),
 *     }));
 *
 *     return order;
 *   }
 *
 *   // Business method raises event
 *   cancel(reason: string): void {
 *     if (this.status === OrderStatus.Shipped) {
 *       throw new Error('Cannot cancel shipped order');
 *     }
 *
 *     this.status = OrderStatus.Cancelled;
 *
 *     // Raise domain event
 *     this.raiseEvent(new OrderCancelledEvent({
 *       orderId: this.id,
 *       reason,
 *       cancelledAt: new Date().toISOString(),
 *     }));
 *   }
 *
 *   private calculateTotal(): number {
 *     return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
 *   }
 * }
 *
 * // Usage in application service
 * class CreateOrderUseCase {
 *   constructor(
 *     private orderRepo: IOrderRepository,
 *     private uow: IUnitOfWork
 *   ) {}
 *
 *   async execute(data: CreateOrderData): Promise<string> {
 *     // Create aggregate (raises OrderCreatedEvent internally)
 *     const order = Order.create(data);
 *
 *     // Save to repository
 *     await this.orderRepo.save(order);
 *     // Repository extracts events and stores in UoW
 *
 *     // Commit transaction
 *     await this.uow.commit();
 *     // UoW publishes events after successful commit
 *
 *     return order.id;
 *   }
 * }
 * ```
 *
 * @example Testing aggregate without infrastructure
 * ```typescript
 * describe('Order Aggregate', () => {
 *   it('should raise OrderCreatedEvent when created', () => {
 *     // No event bus, no database, pure domain logic
 *     const order = Order.create({
 *       customerId: 'customer-123',
 *       items: [{ productId: 'prod-1', quantity: 2, price: 10 }],
 *     });
 *
 *     // Verify event was raised
 *     expect(order.domainEvents).toHaveLength(1);
 *     expect(order.domainEvents[0].eventName).toBe('OrderCreated');
 *     expect(order.domainEvents[0].payload.orderId).toBe(order.id);
 *   });
 *
 *   it('should raise OrderCancelledEvent when cancelled', () => {
 *     const order = Order.create(validData);
 *     order.clearEvents();  // Clear creation event
 *
 *     order.cancel('Customer requested');
 *
 *     expect(order.domainEvents).toHaveLength(1);
 *     expect(order.domainEvents[0].eventName).toBe('OrderCancelled');
 *   });
 * });
 * ```
 */
export interface IEventRaisingEntity {
  /**
   * Internal collection of domain events raised by this entity.
   *
   * @remarks
   * **Readonly Collection:**
   *
   * The collection itself is readonly - callers can read but not modify:
   *
   * ```typescript
   * const events = order.domainEvents;
   *
   * // ✅ OK: Read events
   * console.log('Event count:', events.length);
   * events.forEach(e => console.log(e.eventName));
   *
   * // ❌ Error: Cannot modify
   * events.push(new OrderCreatedEvent(...));  // Error
   * events[0] = new OrderCreatedEvent(...);  // Error
   * ```
   *
   * **Internal Storage:**
   *
   * Internally stored as private array:
   *
   * ```typescript
   * class AggregateRoot implements IEventRaisingEntity {
   *   private _domainEvents: IDomainEvent[] = [];
   *
   *   get domainEvents(): readonly IDomainEvent[] {
   *     return this._domainEvents;  // Readonly view
   *   }
   * }
   * ```
   *
   * **Event Ordering:**
   *
   * Events are stored in the order they were raised:
   *
   * ```typescript
   * order.addItem(item1);  // Raises ItemAddedEvent
   * order.addItem(item2);  // Raises ItemAddedEvent
   * order.cancel();  // Raises OrderCancelledEvent
   *
   * // domainEvents = [
   * //   ItemAddedEvent(item1),
   * //   ItemAddedEvent(item2),
   * //   OrderCancelledEvent
   * // ]
   * ```
   */
  readonly domainEvents: readonly IDomainEvent[];

  /**
   * Clears the internal event collection (called after events are dispatched).
   *
   * @remarks
   * **When to Call:**
   *
   * Call `clearEvents()` after events have been extracted and stored in UnitOfWork:
   *
   * ```typescript
   * class OrderRepository implements IOrderRepository {
   *   async save(order: Order): Promise<void> {
   *     // 1. Save to database
   *     await this.db.orders.save(order);
   *
   *     // 2. Extract events
   *     const events = order.domainEvents;
   *
   *     // 3. Store in UnitOfWork for later publishing
   *     this.uow.addDomainEvents(events);
   *
   *     // 4. Clear events from aggregate
   *     order.clearEvents();
   *     //    ↑ Prevents duplicate publishing!
   *   }
   * }
   * ```
   *
   * **Why Clear:**
   *
   * Clearing prevents duplicate event publishing:
   *
   * ```typescript
   * // Without clearing:
   * const order = Order.create(data);  // Raises OrderCreatedEvent
   * await orderRepo.save(order);  // Events published
   *
   * order.addItem(item);  // Raises ItemAddedEvent
   * await orderRepo.save(order);  // ← Would publish BOTH events again!
   *
   * // With clearing:
   * const order = Order.create(data);  // Raises OrderCreatedEvent
   * await orderRepo.save(order);  // Events published, then cleared
   *
   * order.addItem(item);  // Raises ItemAddedEvent (only new event)
   * await orderRepo.save(order);  // ← Publishes only ItemAddedEvent ✅
   * ```
   *
   * **Typical Pattern:**
   *
   * ```typescript
   * // Repository pattern
   * class Repository<T extends IEventRaisingEntity> {
   *   async save(entity: T): Promise<void> {
   *     await this.db.save(entity);
   *
   *     const events = [...entity.domainEvents];  // Copy events
   *     entity.clearEvents();  // Clear immediately
   *
   *     this.uow.addDomainEvents(events);  // Store for publishing
   *   }
   * }
   * ```
   *
   * @example Complete save flow
   * ```typescript
   * class OrderRepository {
   *   async save(order: Order): Promise<void> {
   *     // 1. Start transaction
   *     const transaction = await this.db.beginTransaction();
   *
   *     try {
   *       // 2. Save entity
   *       await transaction.orders.save(order);
   *
   *       // 3. Extract events
   *       const events = [...order.domainEvents];
   *
   *       // 4. Clear events (prevent duplicates)
   *       order.clearEvents();
   *
   *       // 5. Store events in UnitOfWork
   *       this.uow.addDomainEvents(events);
   *
   *       // 6. Commit (actual publishing happens later)
   *       await transaction.commit();
   *     } catch (error) {
   *       await transaction.rollback();
   *       throw error;
   *     }
   *   }
   * }
   * ```
   */
  clearEvents(): void;
}

/**
 * Interface for publishing domain events.
 *
 * @remarks
 * **Event Bus Pattern:**
 *
 * `IEventBus` acts as a **pub/sub mediator** between event publishers and handlers:
 *
 * ```
 * Publishers (Domain)        Event Bus         Handlers (Application)
 *       ↓                         ↓                    ↓
 * Order.create()  →  publish(OrderCreatedEvent)  →  SendEmailHandler
 *       ↓                         ↓                    ↓
 *                                                  ReserveStockHandler
 *       ↓                         ↓                    ↓
 *                                                  TrackAnalyticsHandler
 * ```
 *
 * **Decoupling Benefits:**
 *
 * - ✅ Publishers don't know about handlers
 * - ✅ Handlers don't know about publishers
 * - ✅ Easy to add/remove handlers
 * - ✅ Independent scaling of handlers
 *
 * **Unit of Work Integration:**
 *
 * Event bus supports two modes:
 *
 * 1. **Immediate Publishing** (no UoW):
 *
 * ```typescript
 * await eventBus.publish(event);  // Published immediately
 * ```
 *
 * 2. **Buffered Publishing** (with UoW):
 *
 * ```typescript
 * // Events buffered during transaction
 * await eventBus.publish(event1);
 * await eventBus.publish(event2);
 *
 * // Published only after commit
 * await uow.commit();
 * // → Now events are actually dispatched
 * ```
 *
 * **Implementation Strategies:**
 *
 * 1. **In-Memory** (same process):
 *
 * ```typescript
 * class InMemoryEventBus implements IEventBus {
 *   private handlers = new Map<string, IEventHandler<any>[]>();
 *
 *   async publish(event: IDomainEvent) {
 *     const handlers = this.handlers.get(event.eventName) || [];
 *     await Promise.all(handlers.map(h => h.handle(event)));
 *   }
 * }
 * ```
 *
 * 2. **Message Queue** (distributed):
 *
 * ```typescript
 * class RabbitMQEventBus implements IEventBus {
 *   async publish(event: IDomainEvent) {
 *     await this.channel.publish(
 *       'events',
 *       event.eventName,
 *       Buffer.from(JSON.stringify(event))
 *     );
 *   }
 * }
 * ```
 *
 * 3. **Event Store** (event sourcing):
 *
 * ```typescript
 * class EventStoreEventBus implements IEventBus {
 *   async publish(event: IDomainEvent) {
 *     await this.eventStore.appendEvent(event);
 *     // Event store triggers handlers
 *   }
 * }
 * ```
 *
 * @example Basic event bus setup
 * ```typescript
 * // Create event bus
 * const eventBus = new InMemoryEventBus();
 *
 * // Register handlers
 * eventBus.registerHandler('OrderCreated', new SendOrderConfirmationHandler());
 * eventBus.registerHandler('OrderCreated', new ReserveStockHandler());
 * eventBus.registerHandler('OrderCreated', new TrackOrderAnalyticsHandler());
 *
 * // Publish event
 * const event = new OrderCreatedEvent(payload);
 * await eventBus.publish(event);
 * // → All three handlers execute
 * ```
 *
 * @example Event bus with Unit of Work
 * ```typescript
 * class UnitOfWork implements IUnitOfWork {
 *   private domainEvents: IDomainEvent[] = [];
 *
 *   constructor(private eventBus: IEventBus) {}
 *
 *   addDomainEvents(events: IDomainEvent[]) {
 *     this.domainEvents.push(...events);
 *   }
 *
 *   async commit() {
 *     // 1. Commit database transaction
 *     await this.transaction.commit();
 *
 *     // 2. Publish events ONLY if commit succeeded
 *     await this.eventBus.publishAll(this.domainEvents);
 *
 *     // 3. Clear published events
 *     this.domainEvents = [];
 *   }
 *
 *   async rollback() {
 *     await this.transaction.rollback();
 *
 *     // Clear events (never publish)
 *     this.domainEvents = [];
 *   }
 * }
 * ```
 */
export interface IEventBus {
  /**
   * Publishes a domain event asynchronously.
   *
   * @template T - Event type
   * @param event - The domain event to publish
   * @returns A promise that resolves when the event is dispatched (or buffered for UoW)
   *
   * @remarks
   * **Async Publishing:**
   *
   * Publishing is asynchronous to handle I/O operations:
   *
   * ```typescript
   * // Handlers may do async work
   * await eventBus.publish(event);
   * //  ↓ Handler 1: Send email (HTTP request)
   * //  ↓ Handler 2: Update cache (Redis)
   * //  ↓ Handler 3: Track analytics (HTTP request)
   * ```
   *
   * **Error Handling:**
   *
   * Failed handlers should be caught to avoid breaking others:
   *
   * ```typescript
   * class EventBus implements IEventBus {
   *   async publish(event: IDomainEvent) {
   *     const handlers = this.handlers.get(event.eventName) || [];
   *
   *     for (const handler of handlers) {
   *       try {
   *         await handler.handle(event);
   *       } catch (error) {
   *         logger.error(`Handler failed for ${event.eventName}`, {
   *           eventId: event.metadata.eventId,
   *           handler: handler.constructor.name,
   *           error,
   *         });
   *         // Continue with other handlers
   *       }
   *     }
   *   }
   * }
   * ```
   *
   * **Buffering for UoW:**
   *
   * Some implementations buffer events:
   *
   * ```typescript
   * class UoWAwareEventBus implements IEventBus {
   *   private buffer: IDomainEvent[] = [];
   *
   *   async publish(event: IDomainEvent) {
   *     if (this.inTransaction) {
   *       // Buffer for later
   *       this.buffer.push(event);
   *     } else {
   *       // Publish immediately
   *       await this.doPublish(event);
   *     }
   *   }
   *
   *   async flush() {
   *     const events = [...this.buffer];
   *     this.buffer = [];
   *
   *     for (const event of events) {
   *       await this.doPublish(event);
   *     }
   *   }
   * }
   * ```
   *
   * @example Simple publishing
   * ```typescript
   * const event = new OrderCreatedEvent(payload);
   * await eventBus.publish(event);
   *
   * console.log('Event published successfully');
   * ```
   *
   * @example Publishing with error handling
   * ```typescript
   * try {
   *   await eventBus.publish(event);
   * } catch (error) {
   *   logger.error('Failed to publish event', {
   *     eventName: event.eventName,
   *     eventId: event.metadata.eventId,
   *     error,
   *   });
   *   throw error;
   * }
   * ```
   */
  publish<T extends IDomainEvent>(event: T): Promise<void>;

  /**
   * Publishes multiple domain events asynchronously (useful after UoW commit).
   *
   * @param events - The domain events to publish
   *
   * @remarks
   * **Batch Publishing:**
   *
   * `publishAll()` is optimized for publishing multiple events:
   *
   * ```typescript
   * // After UoW commit
   * const events = [
   *   OrderCreatedEvent,
   *   StockReservedEvent,
   *   PaymentChargedEvent,
   * ];
   *
   * await eventBus.publishAll(events);
   * ```
   *
   * **Order Preservation:**
   *
   * Events are published in the order they appear in the array:
   *
   * ```typescript
   * await eventBus.publishAll([event1, event2, event3]);
   * // → Handlers for event1
   * // → Handlers for event2
   * // → Handlers for event3
   * ```
   *
   * **Parallel vs Sequential:**
   *
   * Implementations may choose:
   *
   * ```typescript
   * // Sequential (preserves order, slower)
   * async publishAll(events: IDomainEvent[]) {
   *   for (const event of events) {
   *     await this.publish(event);
   *   }
   * }
   *
   * // Parallel (faster, may not preserve order)
   * async publishAll(events: IDomainEvent[]) {
   *   await Promise.all(events.map(e => this.publish(e)));
   * }
   * ```
   *
   * @example Publishing events after UoW commit
   * ```typescript
   * class UnitOfWork {
   *   private domainEvents: IDomainEvent[] = [];
   *
   *   addDomainEvents(events: IDomainEvent[]) {
   *     this.domainEvents.push(...events);
   *   }
   *
   *   async commit() {
   *     await this.transaction.commit();
   *
   *     // Publish all buffered events
   *     await this.eventBus.publishAll(this.domainEvents);
   *
   *     this.domainEvents = [];
   *   }
   * }
   * ```
   *
   * @example Extracting events from aggregate
   * ```typescript
   * class OrderRepository {
   *   async save(order: Order): Promise<void> {
   *     await this.db.orders.save(order);
   *
   *     // Extract all events
   *     const events = [...order.domainEvents];
   *     order.clearEvents();
   *
   *     // Store for later publishing
   *     this.uow.addDomainEvents(events);
   *   }
   * }
   * ```
   */
  publishAll(events: IDomainEvent[]): Promise<void>;

  /**
   * Publishes a domain event synchronously.
   *
   * @template T - Event type
   * @param event - The domain event to publish
   *
   * @remarks
   * **⚠️ Use With Caution:**
   *
   * Synchronous publishing has limitations:
   *
   * - ❌ Blocks the caller
   * - ❌ Can't handle async handlers properly
   * - ❌ Harder to handle errors
   * - ✅ Simpler for testing
   *
   * **When to Use:**
   *
   * Only use sync publishing for:
   *
   * 1. **Testing**: Simpler test code
   * 2. **In-Memory Handlers**: No I/O operations
   * 3. **Legacy Code**: Migrating from sync to async
   *
   * **Prefer Async:**
   *
   * In most cases, use `publish()` instead:
   *
   * ```typescript
   * // ❌ Sync (limited use cases)
   * eventBus.publishSync(event);
   *
   * // ✅ Async (preferred)
   * await eventBus.publish(event);
   * ```
   *
   * @example Sync publishing (testing)
   * ```typescript
   * it('should handle OrderCreatedEvent', () => {
   *   const handler = new TestHandler();
   *   eventBus.registerHandler('OrderCreated', handler);
   *
   *   const event = new OrderCreatedEvent(payload);
   *   eventBus.publishSync(event);  // Synchronous for testing
   *
   *   expect(handler.called).toBe(true);
   * });
   * ```
   */
  publishSync<T extends IDomainEvent>(event: T): void;

  /**
   * Registers an event handler for a specific event type.
   *
   * @param eventName - The name of the event to handle
   * @param handler - The handler instance
   *
   * @remarks
   * **Handler Registration:**
   *
   * Handlers are registered by event name:
   *
   * ```typescript
   * eventBus.registerHandler('OrderCreated', new SendEmailHandler());
   * eventBus.registerHandler('OrderCreated', new ReserveStockHandler());
   * eventBus.registerHandler('PaymentCharged', new UpdateBalanceHandler());
   * ```
   *
   * **Multiple Handlers:**
   *
   * Multiple handlers can subscribe to the same event:
   *
   * ```typescript
   * // All execute when OrderCreated is published
   * eventBus.registerHandler('OrderCreated', handler1);
   * eventBus.registerHandler('OrderCreated', handler2);
   * eventBus.registerHandler('OrderCreated', handler3);
   * ```
   *
   * **Registration Timing:**
   *
   * Register handlers during application startup:
   *
   * ```typescript
   * // During app initialization
   * function registerEventHandlers(eventBus: IEventBus) {
   *   // Order events
   *   eventBus.registerHandler('OrderCreated', container.get(SendOrderConfirmationHandler));
   *   eventBus.registerHandler('OrderCreated', container.get(ReserveStockHandler));
   *   eventBus.registerHandler('OrderCancelled', container.get(RefundPaymentHandler));
   *
   *   // Payment events
   *   eventBus.registerHandler('PaymentCharged', container.get(UpdateAccountHandler));
   *   eventBus.registerHandler('PaymentFailed', container.get(NotifyAdminHandler));
   * }
   * ```
   *
   * @example Handler registration
   * ```typescript
   * // Create handlers
   * const emailHandler = new SendOrderConfirmationHandler(emailService);
   * const stockHandler = new ReserveStockHandler(inventoryService);
   * const analyticsHandler = new TrackOrderAnalyticsHandler(analyticsService);
   *
   * // Register handlers
   * eventBus.registerHandler('OrderCreated', emailHandler);
   * eventBus.registerHandler('OrderCreated', stockHandler);
   * eventBus.registerHandler('OrderCreated', analyticsHandler);
   *
   * // When OrderCreatedEvent is published, all three handlers execute
   * ```
   *
   * @example Auto-registration with decorators
   * ```typescript
   * // Decorator for auto-registration
   * function EventHandler(eventName: string) {
   *   return function (target: any) {
   *     Reflect.defineMetadata('eventHandler:eventName', eventName, target);
   *   };
   * }
   *
   * // Usage
   * @EventHandler('OrderCreated')
   * class SendOrderConfirmationHandler implements IEventHandler<OrderCreatedEvent> {
   *   async handle(event: OrderCreatedEvent) {
   *     // ...
   *   }
   * }
   *
   * // Auto-registration
   * async function autoRegisterHandlers(eventBus: IEventBus) {
   *   const handlerFiles = await glob('src/??/?.handler.ts');
   *
   *   for (const file of handlerFiles) {
   *     const HandlerClass = await import(file);
   *     const eventName = Reflect.getMetadata('eventHandler:eventName', HandlerClass);
   *
   *     if (eventName) {
   *       const handler = container.get(HandlerClass);
   *       eventBus.registerHandler(eventName, handler);
   *     }
   *   }
   * }
   * ```
   */
  registerHandler(eventName: string, handler: IEventHandler<any>): void;
}

/**
 * Interface for handling a specific domain event.
 *
 * @template TEvent - The type of the domain event this handler processes
 *
 * @remarks
 * **Single Responsibility:**
 *
 * Each handler should do ONE thing:
 *
 * - ✅ **Good**: `SendOrderConfirmationHandler` sends email
 * - ❌ **Bad**: `OrderCreatedHandler` sends email AND reserves stock AND updates analytics
 *
 * **Independent Handlers:**
 *
 * Handlers should be independent:
 *
 * ```typescript
 * // ✅ GOOD: Independent handlers
 * class SendEmailHandler {
 *   async handle(event: OrderCreatedEvent) {
 *     await emailService.send(event.payload.customerEmail);
 *   }
 * }
 *
 * class ReserveStockHandler {
 *   async handle(event: OrderCreatedEvent) {
 *     await inventoryService.reserve(event.payload.items);
 *   }
 * }
 *
 * // ❌ BAD: Coupled handlers
 * class SendEmailHandler {
 *   async handle(event: OrderCreatedEvent) {
 *     await emailService.send(event.payload.customerEmail);
 *     await stockHandler.handle(event);  // ← Coupled!
 *   }
 * }
 * ```
 *
 * **Idempotency:**
 *
 * Handlers should be idempotent (safe to execute multiple times):
 *
 * ```typescript
 * class SendEmailHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent) {
 *     // Check if already sent
 *     const exists = await emailLog.exists(event.metadata.eventId);
 *     if (exists) {
 *       return;  // Already processed
 *     }
 *
 *     // Send email
 *     await emailService.send(event.payload.customerEmail);
 *
 *     // Mark as processed
 *     await emailLog.create(event.metadata.eventId);
 *   }
 * }
 * ```
 *
 * **Error Handling:**
 *
 * Handlers should handle errors gracefully:
 *
 * ```typescript
 * class NotificationHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent) {
 *     try {
 *       await notificationService.notify(event.payload.customerId);
 *     } catch (error) {
 *       logger.error('Notification failed', {
 *         eventId: event.metadata.eventId,
 *         customerId: event.payload.customerId,
 *         error,
 *       });
 *
 *       // Optionally retry or send to dead letter queue
 *       await deadLetterQueue.add(event);
 *     }
 *   }
 * }
 * ```
 *
 * @example Email handler
 * ```typescript
 * class SendOrderConfirmationHandler implements IEventHandler<OrderCreatedEvent> {
 *   constructor(
 *     private emailService: IEmailService,
 *     private logger: ILogger
 *   ) {}
 *
 *   async handle(event: OrderCreatedEvent): Promise<void> {
 *     this.logger.info('Sending order confirmation', {
 *       orderId: event.payload.orderId,
 *       customerEmail: event.payload.customerEmail,
 *     });
 *
 *     await this.emailService.send({
 *       to: event.payload.customerEmail,
 *       subject: 'Order Confirmation',
 *       template: 'order-confirmation',
 *       data: {
 *         orderId: event.payload.orderId,
 *         total: event.payload.total,
 *         items: event.payload.items,
 *       },
 *     });
 *
 *     this.logger.info('Order confirmation sent', {
 *       orderId: event.payload.orderId,
 *     });
 *   }
 * }
 * ```
 *
 * @example Analytics handler
 * ```typescript
 * class TrackOrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
 *   constructor(private analyticsService: IAnalyticsService) {}
 *
 *   async handle(event: OrderCreatedEvent): Promise<void> {
 *     await this.analyticsService.track({
 *       event: 'Order Created',
 *       userId: event.metadata.actorId,
 *       properties: {
 *         orderId: event.payload.orderId,
 *         total: event.payload.total,
 *         itemCount: event.payload.items.length,
 *       },
 *       timestamp: event.metadata.occurredAt,
 *     });
 *   }
 * }
 * ```
 */
export interface IEventHandler<TEvent extends IDomainEvent> {
  /**
   * Processes the domain event.
   *
   * @param event - The event instance to handle
   * @returns A promise for asynchronous handling
   *
   * @remarks
   * **Async Processing:**
   *
   * Handlers are typically async because they perform I/O:
   *
   * ```typescript
   * async handle(event: OrderCreatedEvent) {
   *   await emailService.send(...);     // HTTP request
   *   await cache.invalidate(...);       // Redis operation
   *   await analytics.track(...);        // HTTP request
   * }
   * ```
   *
   * **Error Propagation:**
   *
   * Errors thrown by handlers should be caught by the event bus:
   *
   * ```typescript
   * async handle(event: OrderCreatedEvent) {
   *   if (!event.payload.customerEmail) {
   *     throw new Error('Customer email is required');
   *     // ← Event bus catches this
   *   }
   *
   *   await emailService.send(event.payload.customerEmail);
   * }
   * ```
   *
   * **Long-Running Handlers:**
   *
   * For long-running operations, consider background jobs:
   *
   * ```typescript
   * async handle(event: OrderCreatedEvent) {
   *   // Don't block event publishing
   *   await jobQueue.enqueue('process-order-analytics', {
   *     orderId: event.payload.orderId,
   *     eventId: event.metadata.eventId,
   *   });
   *
   *   // Handler returns immediately
   * }
   * ```
   *
   * @example Complete handler implementation
   * ```typescript
   * class SendOrderConfirmationHandler implements IEventHandler<OrderCreatedEvent> {
   *   constructor(
   *     private emailService: IEmailService,
   *     private logger: ILogger
   *   ) {}
   *
   *   async handle(event: OrderCreatedEvent): Promise<void> {
   *     const { orderId, customerEmail, items, total } = event.payload;
   *
   *     // Log handling
   *     this.logger.info('Sending order confirmation', {
   *       eventId: event.metadata.eventId,
   *       orderId,
   *       customerEmail,
   *     });
   *
   *     try {
   *       // Send email
   *       await this.emailService.send({
   *         to: customerEmail,
   *         subject: `Order Confirmation - ${orderId}`,
   *         template: 'order-confirmation',
   *         data: { orderId, items, total },
   *       });
   *
   *       this.logger.info('Order confirmation sent successfully', {
   *         eventId: event.metadata.eventId,
   *         orderId,
   *       });
   *     } catch (error) {
   *       this.logger.error('Failed to send order confirmation', {
   *         eventId: event.metadata.eventId,
   *         orderId,
   *         error,
   *       });
   *
   *       // Re-throw to trigger retry mechanism
   *       throw error;
   *     }
   *   }
   * }
   * ```
   */
  handle(event: TEvent): Promise<void>;
}

/**
 * Abstract base class for Aggregate Roots implementing domain event raising.
 *
 * @remarks
 * **Domain Purity Guarantee:**
 *
 * This base class maintains domain purity by:
 * - Storing events internally (not publishing)
 * - Having ZERO infrastructure dependencies
 * - Providing only event collection methods
 *
 * **Usage Pattern:**
 *
 * ```typescript
 * class Order extends AggregateRoot {
 *   private constructor(
 *     public readonly id: string,
 *     public readonly customerId: string,
 *     public readonly total: number
 *   ) {
 *     super();
 *   }
 *
 *   static create(customerId: string, total: number): Order {
 *     const order = new Order(`order-${Date.now()}`, customerId, total);
 *
 *     // Raise event (stored internally, NOT published)
 *     order.raiseEvent(
 *       new OrderCreatedEvent({
 *         orderId: order.id,
 *         customerId: order.customerId,
 *         total: order.total,
 *       })
 *     );
 *
 *     return order;
 *   }
 * }
 * ```
 *
 * **Integration with Repository:**
 *
 * ```typescript
 * class OrderRepository {
 *   async save(order: Order): Promise<void> {
 *     // 1. Save to database
 *     await this.db.orders.save(order);
 *
 *     // 2. Extract events
 *     const events = [...order.domainEvents];
 *     order.clearEvents();
 *
 *     // 3. Buffer events in Unit of Work
 *     this.unitOfWork.addDomainEvents(events);
 *
 *     // Events will be published ONLY if transaction commits successfully
 *   }
 * }
 * ```
 *
 * @example Creating aggregate with events
 * ```typescript
 * class User extends AggregateRoot {
 *   constructor(
 *     public readonly id: string,
 *     public email: string,
 *     public name: string
 *   ) {
 *     super();
 *   }
 *
 *   static create(email: string, name: string): User {
 *     const user = new User(generateId(), email, name);
 *
 *     user.raiseEvent(
 *       new UserCreatedEvent({
 *         userId: user.id,
 *         email: user.email,
 *         name: user.name,
 *       })
 *     );
 *
 *     return user;
 *   }
 *
 *   changeEmail(newEmail: string): void {
 *     const oldEmail = this.email;
 *     this.email = newEmail;
 *
 *     this.raiseEvent(
 *       new UserEmailChangedEvent({
 *         userId: this.id,
 *         oldEmail,
 *         newEmail,
 *       })
 *     );
 *   }
 * }
 * ```
 */
export abstract class AggregateRoot implements IEventRaisingEntity {
  /**
   * Private array of domain events raised by this aggregate.
   *
   * @remarks
   * This array is private to enforce encapsulation.
   * Events can only be accessed via the `domainEvents` getter.
   */
  private _domainEvents: IDomainEvent[] = [];

  /**
   * Get all domain events raised by this aggregate.
   *
   * @returns Readonly array of domain events
   *
   * @remarks
   * Returns a readonly array to prevent external mutation.
   * Events should only be added via `raiseEvent()` and cleared via `clearEvents()`.
   *
   * @example
   * ```typescript
   * const user = User.create('john@example.com', 'John Doe');
   * console.log(user.domainEvents.length); // 1 (UserCreatedEvent)
   * console.log(user.domainEvents[0].eventName); // 'UserCreated'
   * ```
   */
  get domainEvents(): readonly IDomainEvent[] {
    return this._domainEvents;
  }

  /**
   * Raise a domain event from this aggregate.
   *
   * @param event - The domain event to raise
   *
   * @remarks
   * **Important:**
   * - Events are stored internally, NOT published immediately
   * - Events will be published by infrastructure layer after transaction commit
   * - This maintains domain purity (no infrastructure dependencies)
   *
   * **Event Lifecycle:**
   * ```
   * 1. Aggregate raises event → stored in _domainEvents[]
   * 2. Repository saves aggregate → extracts events
   * 3. Repository buffers events in Unit of Work
   * 4. Transaction commits → events published
   * 5. Transaction rollback → events discarded
   * ```
   *
   * @example
   * ```typescript
   * class Order extends AggregateRoot {
   *   cancel(reason: string): void {
   *     if (this.status === 'cancelled') {
   *       throw new DomainError('Order already cancelled');
   *     }
   *
   *     this.status = 'cancelled';
   *
   *     // Raise event (stored internally)
   *     this.raiseEvent(
   *       new OrderCancelledEvent({
   *         orderId: this.id,
   *         reason,
   *         cancelledAt: new Date().toISOString(),
   *       })
   *     );
   *   }
   * }
   * ```
   */
  protected raiseEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear all domain events from this aggregate.
   *
   * @remarks
   * **When to Call:**
   * - After extracting events in repository
   * - Before re-publishing events (to prevent duplicates)
   * - When transaction rollback discards events
   *
   * **Repository Pattern:**
   * ```typescript
   * class OrderRepository {
   *   async save(order: Order): Promise<void> {
   *     await this.db.orders.save(order);
   *
   *     // Extract events
   *     const events = [...order.domainEvents];
   *
   *     // Clear to prevent re-publishing
   *     order.clearEvents();
   *
   *     // Buffer in Unit of Work
   *     this.unitOfWork.addDomainEvents(events);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * const user = User.create('john@example.com', 'John Doe');
   * console.log(user.domainEvents.length); // 1
   *
   * const events = [...user.domainEvents];
   * user.clearEvents();
   *
   * console.log(user.domainEvents.length); // 0
   * console.log(events.length); // 1 (events still available)
   * ```
   */
  clearEvents(): void {
    this._domainEvents = [];
  }
}
