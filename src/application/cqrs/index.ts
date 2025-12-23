/**
 * @fileoverview CQRS (Command Query Responsibility Segregation) Exports
 * @description
 * This module exports all CQRS-related abstractions including:
 * - Commands and Command Handlers for write operations
 * - Queries and Query Handlers for read operations
 * - Command/Query Buses for dispatching
 * - Pipeline Behaviors for cross-cutting concerns
 *
 * CQRS separates read and write operations for better scalability,
 * performance, and maintainability in complex domain applications.
 *
 * @packageDocumentation
 * @module @struktos/core/application/cqrs
 * @version 1.0.0
 *
 * @see {@link https://martinfowler.com/bliki/CQRS.html | Martin Fowler - CQRS}
 *
 * @example
 * ```typescript
 * import {
 *   CommandBase,
 *   QueryBase,
 *   ICommandHandler,
 *   IQueryHandler,
 *   ICommandBus
 * } from '@struktos/core/application/cqrs';
 *
 * // Define a command
 * class CreateUserCommand extends CommandBase<string> {
 *   constructor(
 *     public readonly email: string,
 *     public readonly name: string
 *   ) {
 *     super();
 *   }
 * }
 *
 * // Implement the handler
 * class CreateUserHandler implements ICommandHandler<CreateUserCommand, string> {
 *   async execute(command: CreateUserCommand): Promise<string> {
 *     // Create user and return ID
 *     return 'user-123';
 *   }
 * }
 * ```
 */

// Command abstractions
export {
  // Base class
  CommandBase,
  // DI Token
  COMMAND_BUS_TOKEN,
} from './ICommand';

export type {
  // Interfaces
  ICommand,
  ICommandBus,
  ICommandHandler,

  // Types
  CommandMetadata,
  CommandExecutionOptions,
  CommandResult,
} from './ICommand';

// Query abstractions
export {
  // Base class
  QueryBase,

  // DI Token
  QUERY_BUS_TOKEN,
} from './IQuery';

export type {
  // Interfaces
  IQuery,
  IQueryBus,
  IQueryHandler,

  // Types
  QueryMetadata,
  QueryExecutionOptions,
  QueryResult,
  PaginationParams,
  PaginatedResult,
} from './IQuery';

// Handler abstractions and pipeline
export {
  // Base classes
  CommandHandlerBase,
  QueryHandlerBase,

  // DI Tokens
  COMMAND_HANDLERS_TOKEN,
  QUERY_HANDLERS_TOKEN,
  PIPELINE_BEHAVIORS_TOKEN,
} from './IHandler';

// Handler abstractions and pipeline
export type {
  // Handler context
  HandlerContext,

  // Pipeline behavior
  IPipelineBehavior,
  HandlerMetadata,
  IHandlerLogger,
} from './IHandler';
