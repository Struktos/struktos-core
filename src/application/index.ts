/**
 * @fileoverview Application Layer Exports
 * @description
 * The Application Layer orchestrates domain logic and coordinates
 * the execution of use cases. This layer implements the application's
 * business logic through:
 *
 * - **CQRS Pattern**: Separates commands (writes) from queries (reads)
 * - **Use Case Handlers**: Command and Query handlers for each use case
 * - **Pipeline Behaviors**: Cross-cutting concerns like logging, validation
 *
 * This layer is independent of infrastructure concerns and depends
 * only on the Domain layer abstractions.
 *
 * @packageDocumentation
 * @module @struktos/core/application
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   CommandBase,
 *   ICommandHandler,
 *   ICommandBus,
 *   HandlerContext,
 *   IPipelineBehavior
 * } from '@struktos/core/application';
 *
 * // Define a command for user registration
 * class RegisterUserCommand extends CommandBase<UserId> {
 *   constructor(
 *     public readonly email: string,
 *     public readonly password: string
 *   ) {
 *     super();
 *   }
 *
 *   validate(): ValidationResult {
 *     if (!this.email.includes('@')) {
 *       return { isValid: false, errors: [{ field: 'email', message: 'Invalid email' }] };
 *     }
 *     return { isValid: true, errors: [] };
 *   }
 * }
 *
 * // Create a logging pipeline behavior
 * class LoggingBehavior<TRequest, TResponse> implements IPipelineBehavior<TRequest, TResponse> {
 *   async handle(
 *     request: TRequest,
 *     next: () => Promise<TResponse>,
 *     context?: HandlerContext<any>
 *   ): Promise<TResponse> {
 *     console.log(`Handling ${request.constructor.name}`);
 *     const result = await next();
 *     console.log(`Handled ${request.constructor.name}`);
 *     return result;
 *   }
 * }
 * ```
 */

// CQRS Pattern exports
export * from './cqrs';

// Application hosting, adapters, and lifecycle management
export * from './host'

// Application adapters
export * from './ports'