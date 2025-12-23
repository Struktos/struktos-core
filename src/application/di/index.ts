/**
 * @module @struktos/core/application/di
 * @description Dependency Injection container exports with advanced features
 *
 * @remarks
 * This version assumes the following types have been added to IDependencyInjection.ts:
 * - ServiceFactory<T>
 * - ServiceRegistrationOptions
 * - ServiceDescriptor<T>
 *
 * If these types are not present in IDependencyInjection.ts, use the FIXED version instead.
 */

// ============================================================================
// Core Interfaces
// ============================================================================

export type {
  IServiceCollection,
  IDIServiceProvider,
  IServiceScope,
} from './IDependencyInjection';

// ============================================================================
// Advanced Types (if implemented)
// ============================================================================

/**
 * Service descriptor containing registration metadata.
 *
 * @remarks
 * Available if advanced DI features are implemented.
 * Used for service discovery and validation.
 *
 * @example
 * ```typescript
 * import { ServiceDescriptor } from '@struktos/core/application/di';
 *
 * const descriptors: ServiceDescriptor[] = services.getDescriptors();
 * const loggerDescriptor = descriptors.find(d => d.serviceType === ILogger);
 * ```
 */
export type { ServiceDescriptor } from './IDependencyInjection';

/**
 * Factory function type for creating service instances.
 *
 * @remarks
 * Available if factory-based registration is implemented.
 *
 * @example
 * ```typescript
 * import { ServiceFactory } from '@struktos/core/application/di';
 *
 * const factory: ServiceFactory<IDatabase> = (provider) => {
 *   const config = provider.getService(IConfig);
 *   return new PostgresDatabase(config.dbUrl);
 * };
 *
 * services.addSingletonFactory(IDatabase, factory);
 * ```
 */
export type { ServiceFactory } from './IDependencyInjection';

/**
 * Additional options for service registration.
 *
 * @remarks
 * Available if advanced registration features are implemented.
 * Supports named registrations, tags, and metadata.
 *
 * @example
 * ```typescript
 * import { ServiceRegistrationOptions } from '@struktos/core/application/di';
 *
 * const options: ServiceRegistrationOptions = {
 *   name: 'primary',
 *   tags: ['database', 'postgres'],
 *   metadata: { version: '2.0' }
 * };
 *
 * services.addScoped(IDatabase, PostgresDatabase, options);
 * ```
 */
export type { ServiceRegistrationOptions } from './IDependencyInjection';

// ============================================================================
// Enums
// ============================================================================

export { ServiceScope } from './IDependencyInjection';

// ============================================================================
// Decorators
// ============================================================================

export { Injectable, Inject } from './IDependencyInjection';

// ============================================================================
// Error Classes
// ============================================================================

export { DependencyResolutionError } from './IDependencyInjection';

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * Service lifetime scopes for dependency injection
 *
 * @example
 * ```typescript
 * import { ServiceScope, Injectable } from '@struktos/core/application/di';
 *
 * @Injectable({ scope: ServiceScope.Singleton })
 * class ConfigService {
 *   // Shared instance across application
 * }
 *
 * @Injectable({ scope: ServiceScope.Scoped })
 * class DatabaseContext {
 *   // New instance per request
 * }
 *
 * @Injectable({ scope: ServiceScope.Transient })
 * class CommandHandler {
 *   // New instance every resolution
 * }
 * ```
 */
export type { ServiceScope as Lifetime } from './IDependencyInjection';
