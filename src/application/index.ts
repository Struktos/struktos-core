/**
 * @module @struktos/core/application
 * @description Application layer exports
 */

// ============================================================================
// CQRS Pattern
// ============================================================================

export * from './cqrs';

// ============================================================================
// Dependency Injection
// ============================================================================

export * from './di';

// ============================================================================
// Host & Background Services
// ============================================================================

export * from './host';

// ============================================================================
// Re-exports for Common Use Cases
// ============================================================================

/**
 * Dependency Injection exports
 *
 * @example
 * ```typescript
 * import {
 *   ServiceScope,
 *   Injectable,
 *   Inject,
 *   IServiceCollection,
 *   IServiceProvider
 * } from '@struktos/core/application';
 *
 * @Injectable({ scope: ServiceScope.Singleton })
 * class MyService {
 *   constructor(
 *     @Inject(LoggerService) private logger: LoggerService
 *   ) {}
 * }
 * ```
 */
export type {
  IServiceCollection,
  IDIServiceProvider,
  IServiceScope,
} from './di';

export { ServiceScope } from './di';
export { Injectable, Inject } from './di';
export { DependencyResolutionError } from './di';

/**
 * CQRS exports
 *
 * @example
 * ```typescript
 * import {
 *   CommandBase,
 *   QueryBase,
 *   ICommandHandler,
 *   IQueryHandler
 * } from '@struktos/core/application';
 * ```
 */
export type {
  ICommand,
  IQuery,
  ICommandHandler,
  IQueryHandler,
  ICommandBus,
  IQueryBus,
} from './cqrs';

/**
 * Host & Background Services exports
 *
 * @example
 * ```typescript
 * import {
 *   StruktosApp,
 *   createApp,
 *   IBackgroundService
 * } from '@struktos/core/application';
 * ```
 */
export type { StruktosApp, IBackgroundService } from './host';
