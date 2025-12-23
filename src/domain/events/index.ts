/**
 * @module @struktos/core/domain/events
 * @description Domain events and event bus exports
 */

// ============================================================================
// Core Interfaces
// ============================================================================

export type {
  EventMetadata,
  IDomainEvent,
  IEventRaisingEntity,
  IEventBus,
  IEventHandler,
} from './IDomainEvent';

// ============================================================================
// Base Classes
// ============================================================================

export { AggregateRoot } from './IDomainEvent';

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * Domain event with typed payload
 *
 * @example
 * ```typescript
 * import { IDomainEvent } from '@struktos/core/domain/events';
 *
 * interface OrderCreatedPayload {
 *   orderId: string;
 *   customerId: string;
 *   total: number;
 * }
 *
 * class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
 *   public readonly eventName = 'OrderCreated';
 *   public readonly metadata: EventMetadata;
 *
 *   constructor(public readonly payload: OrderCreatedPayload) {
 *     this.metadata = {
 *       eventId: generateId(),
 *       occurredAt: new Date().toISOString(),
 *     };
 *   }
 * }
 * ```
 */
export type { IDomainEvent as DomainEvent } from './IDomainEvent';

/**
 * Entity that can raise domain events
 *
 * @example
 * ```typescript
 * import { IEventRaisingEntity } from '@struktos/core/domain/events';
 *
 * abstract class AggregateRoot implements IEventRaisingEntity {
 *   private _domainEvents: IDomainEvent[] = [];
 *
 *   get domainEvents(): readonly IDomainEvent[] {
 *     return this._domainEvents;
 *   }
 *
 *   protected raiseEvent(event: IDomainEvent): void {
 *     this._domainEvents.push(event);
 *   }
 *
 *   clearEvents(): void {
 *     this._domainEvents = [];
 *   }
 * }
 * ```
 */
export type { IEventRaisingEntity as EventRaisingEntity } from './IDomainEvent';

/**
 * Event handler interface
 *
 * @example
 * ```typescript
 * import { IEventHandler } from '@struktos/core/domain/events';
 *
 * class SendEmailHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent): Promise<void> {
 *     await emailService.send({
 *       to: event.payload.customerEmail,
 *       subject: 'Order Confirmed',
 *       body: `Your order ${event.payload.orderId} has been confirmed.`
 *     });
 *   }
 * }
 * ```
 */
export type { IEventHandler as EventHandler } from './IDomainEvent';

/**
 * Aggregate root base class with event raising capabilities
 *
 * @example
 * ```typescript
 * import { AggregateRoot } from '@struktos/core/domain/events';
 *
 * class Order extends AggregateRoot {
 *   static create(customerId: string, total: number): Order {
 *     const order = new Order(generateId(), customerId, total);
 *     order.raiseEvent(new OrderCreatedEvent({ orderId: order.id, customerId, total }));
 *     return order;
 *   }
 * }
 * ```
 */
export type { AggregateRoot as AggregateRootBase } from './IDomainEvent';
