/**
 * @module @struktos/core/domain
 * @description Domain layer exports
 */

// ============================================================================
// Context Management
// ============================================================================

export * from './context';

// ============================================================================
// Domain Events
// ============================================================================

export * from './events';

// ============================================================================
// Repository Pattern
// ============================================================================

export * from './repository';

// ============================================================================
// Specification Pattern
// ============================================================================

export * from './specification';

// ============================================================================
// Re-exports for Common Use Cases
// ============================================================================

/**
 * Context exports
 *
 * @example
 * ```typescript
 * import {
 *   IContext,
 *   RequestContext,
 *   StruktosContextData
 * } from '@struktos/core/domain';
 *
 * await RequestContext.run({ traceId: 'trace-123' }, async () => {
 *   const ctx = RequestContext.current();
 *   console.log(ctx?.get('traceId'));
 * });
 * ```
 */
export type { IContext, StruktosContextData } from './context';

/**
 * Domain Events exports
 *
 * @example
 * ```typescript
 * import {
 *   IDomainEvent,
 *   IEventRaisingEntity,
 *   IEventBus,
 *   IEventHandler
 * } from '@struktos/core/domain';
 *
 * class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
 *   eventName = 'OrderCreated';
 *   metadata = { eventId: 'evt-123', occurredAt: new Date().toISOString() };
 *   constructor(public readonly payload: OrderCreatedPayload) {}
 * }
 *
 * class Order extends AggregateRoot {
 *   static create(data: CreateOrderData): Order {
 *     const order = new Order(data);
 *     order.raiseEvent(new OrderCreatedEvent({ orderId: order.id }));
 *     return order;
 *   }
 * }
 * ```
 */
export type {
  EventMetadata,
  IDomainEvent,
  IEventRaisingEntity,
  IEventBus,
  IEventHandler,
} from './events';

export { AggregateRoot } from './events';
export type { AggregateRoot as AggregateRootBase } from './events';

/**
 * Repository exports
 *
 * @example
 * ```typescript
 * import {
 *   IRepository,
 *   IUnitOfWork,
 *   IsolationLevel
 * } from '@struktos/core/domain';
 * ```
 */
export type {
  //IRepository,
  IUnitOfWork,
  IUnitOfWorkFactory,
  IsolationLevel,
} from './repository';
export { TransactionState } from './repository';

/**
 * Specification exports
 *
 * @example
 * ```typescript
 * import {
 *   ISpecification,
 *   SpecificationBase
 * } from '@struktos/core/domain';
 *
 * class ActiveUserSpec extends SpecificationBase<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.isActive && !user.isDeleted;
 *   }
 * }
 * ```
 */
export type { ISpecification } from './specification';
