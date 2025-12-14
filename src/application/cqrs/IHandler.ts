/**
 * @struktos/core - CQRS Handler Interfaces
 *
 * Provides Handler abstractions for the CQRS (Command Query Responsibility Segregation)
 * pattern. Handlers contain the business logic for processing Commands and Queries,
 * following the Single Responsibility Principle.
 *
 * @module application/cqrs/IHandler
 * @see {@link https://martinfowler.com/bliki/CQRS.html | CQRS Pattern}
 */

import type { IContext, StruktosContextData } from '../../domain/context/IContext';
import type { ICommand, CommandMetadata } from './ICommand';
import type { IQuery, QueryMetadata } from './IQuery';

/**
 * Handler execution context.
 *
 * Provides contextual information available to handlers during execution,
 * including the request context, metadata, and utilities.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @example
 * ```typescript
 * class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
 *   async execute(command: CreateUserCommand, context: HandlerContext): Promise<User> {
 *     const { traceId, userId } = context;
 *
 *     this.logger.info('Creating user', { traceId, initiatedBy: userId });
 *
 *     // Check for cancellation
 *     if (context.isCancelled()) {
 *       throw new OperationCancelledError('User creation cancelled');
 *     }
 *
 *     return this.userRepo.create(command);
 *   }
 * }
 * ```
 */
export interface HandlerContext<TContext extends StruktosContextData = StruktosContextData> {
  /**
   * Trace ID for distributed tracing.
   */
  traceId?: string;

  /**
   * Request ID for this specific request.
   */
  requestId?: string;

  /**
   * ID of the user initiating the operation.
   */
  userId?: string;

  /**
   * User's roles for authorization checks.
   */
  roles?: string[];

  /**
   * User's claims for fine-grained authorization.
   */
  claims?: Array<{ type: string; value: string }>;

  /**
   * Original request context.
   */
  requestContext?: IContext<TContext>;

  /**
   * Check if the operation has been cancelled.
   *
   * @returns True if the operation should be cancelled
   *
   * @example
   * ```typescript
   * for (const item of items) {
   *   if (context.isCancelled()) {
   *     throw new OperationCancelledError('Batch processing cancelled');
   *   }
   *   await processItem(item);
   * }
   * ```
   */
  isCancelled(): boolean;

  /**
   * Register a callback to be invoked on cancellation.
   *
   * @param callback - Function to call when operation is cancelled
   *
   * @example
   * ```typescript
   * const abortController = new AbortController();
   * context.onCancel(() => abortController.abort());
   *
   * await fetch(url, { signal: abortController.signal });
   * ```
   */
  onCancel(callback: () => void): void;

  /**
   * Start time of the handler execution.
   */
  startTime: number;

  /**
   * Additional context data passed from the bus.
   */
  data?: Record<string, unknown>;
}

/**
 * ICommandHandler - Handler interface for CQRS commands.
 *
 * Command handlers contain the business logic for executing commands.
 * Each command type should have exactly one handler registered.
 *
 * @template TCommand - The command type this handler processes
 * @template TResult - The type of result returned by the handler
 *
 * @remarks
 * Command handlers should:
 * - **Be single-purpose**: Handle exactly one command type
 * - **Manage transactions**: Start/commit/rollback transactions as needed
 * - **Validate input**: Verify command data before processing
 * - **Emit events**: Publish domain events after successful operations
 * - **Be idempotent**: When possible, handle duplicate commands gracefully
 *
 * @example
 * ```typescript
 * // Simple command handler
 * @Injectable()
 * class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
 *   constructor(
 *     private readonly userRepository: IUserRepository,
 *     private readonly eventBus: IEventBus,
 *     private readonly logger: ILogger,
 *   ) {}
 *
 *   async execute(command: CreateUserCommand, context?: HandlerContext): Promise<User> {
 *     this.logger.info('Creating user', {
 *       traceId: context?.traceId,
 *       email: command.email,
 *     });
 *
 *     // Validate
 *     const existingUser = await this.userRepository.findByEmail(command.email);
 *     if (existingUser) {
 *       throw new ConflictError('User with this email already exists');
 *     }
 *
 *     // Create user
 *     const user = await this.userRepository.create({
 *       name: command.name,
 *       email: command.email,
 *       role: command.role,
 *     });
 *
 *     // Emit event
 *     await this.eventBus.publish(new UserCreatedEvent(user));
 *
 *     return user;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Command handler with Unit of Work
 * @Injectable()
 * class TransferFundsHandler implements ICommandHandler<TransferFundsCommand, TransferResult> {
 *   constructor(
 *     private readonly unitOfWork: IUnitOfWork,
 *     private readonly logger: ILogger,
 *   ) {}
 *
 *   async execute(command: TransferFundsCommand): Promise<TransferResult> {
 *     return this.unitOfWork.executeInTransaction(async (uow) => {
 *       const accountRepo = uow.getRepository<IAccountRepository>('AccountRepository');
 *       const transactionRepo = uow.getRepository<ITransactionRepository>('TransactionRepository');
 *
 *       // Debit source account
 *       const sourceAccount = await accountRepo.findById(command.fromAccountId);
 *       if (!sourceAccount || sourceAccount.balance < command.amount) {
 *         throw new InsufficientFundsError();
 *       }
 *       await accountRepo.debit(command.fromAccountId, command.amount);
 *
 *       // Credit destination account
 *       await accountRepo.credit(command.toAccountId, command.amount);
 *
 *       // Record transaction
 *       const transaction = await transactionRepo.create({
 *         fromAccountId: command.fromAccountId,
 *         toAccountId: command.toAccountId,
 *         amount: command.amount,
 *         currency: command.currency,
 *         timestamp: new Date(),
 *       });
 *
 *       return { transactionId: transaction.id, success: true };
 *     }, { isolationLevel: IsolationLevel.Serializable });
 *   }
 * }
 * ```
 */
export interface ICommandHandler<TCommand extends ICommand<TResult>, TResult = void> {
  /**
   * Execute the command and return a result.
   *
   * This method contains the business logic for processing the command.
   * It should validate input, perform the operation, and return the result.
   *
   * @param command - The command to execute
   * @param context - Optional execution context with tracing and cancellation support
   * @returns Promise resolving to the command result
   * @throws Should throw appropriate domain exceptions on failure
   *
   * @example
   * ```typescript
   * async execute(command: CreateOrderCommand, context?: HandlerContext): Promise<Order> {
   *   // Validate
   *   if (!command.items.length) {
   *     throw new ValidationError('Order must have at least one item');
   *   }
   *
   *   // Check cancellation
   *   if (context?.isCancelled()) {
   *     throw new OperationCancelledError();
   *   }
   *
   *   // Execute
   *   const order = await this.orderRepository.create({
   *     customerId: command.customerId,
   *     items: command.items,
   *     total: this.calculateTotal(command.items),
   *   });
   *
   *   return order;
   * }
   * ```
   */
  execute(command: TCommand, context?: HandlerContext): Promise<TResult>;
}

/**
 * IQueryHandler - Handler interface for CQRS queries.
 *
 * Query handlers contain the logic for fetching and transforming data.
 * Each query type should have exactly one handler registered.
 *
 * @template TQuery - The query type this handler processes
 * @template TResult - The type of result returned by the handler
 *
 * @remarks
 * Query handlers should:
 * - **Be read-only**: Never modify state, only read data
 * - **Be optimized**: Use projections, indexes, and caching
 * - **Transform data**: Map domain entities to DTOs/view models
 * - **Handle null cases**: Return null or empty collections gracefully
 *
 * @example
 * ```typescript
 * // Simple query handler
 * @Injectable()
 * class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
 *   constructor(
 *     private readonly userRepository: IUserRepository,
 *     private readonly cache: ICacheManager,
 *     private readonly logger: ILogger,
 *   ) {}
 *
 *   async execute(query: GetUserByIdQuery, context?: HandlerContext): Promise<User | null> {
 *     const cacheKey = `user:${query.userId}`;
 *
 *     // Try cache first
 *     const cached = await this.cache.get<User>(cacheKey);
 *     if (cached) {
 *       this.logger.debug('Cache hit for user', { userId: query.userId });
 *       return cached;
 *     }
 *
 *     // Fetch from database
 *     const user = await this.userRepository.findById(query.userId);
 *
 *     if (user) {
 *       await this.cache.set(cacheKey, user, { ttl: 300 });
 *     }
 *
 *     return user;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Paginated query handler with filtering
 * @Injectable()
 * class ListOrdersHandler implements IQueryHandler<ListOrdersQuery, PaginatedResult<OrderDto>> {
 *   constructor(
 *     private readonly orderRepository: IOrderRepository,
 *   ) {}
 *
 *   async execute(query: ListOrdersQuery): Promise<PaginatedResult<OrderDto>> {
 *     const { page, pageSize, customerId, status, sortBy, sortOrder } = query;
 *
 *     const [orders, total] = await this.orderRepository.findWithCount({
 *       where: {
 *         ...(customerId && { customerId }),
 *         ...(status && { status }),
 *       },
 *       orderBy: sortBy ? { [sortBy]: sortOrder || 'asc' } : undefined,
 *       skip: (page - 1) * pageSize,
 *       take: pageSize,
 *     });
 *
 *     const totalPages = Math.ceil(total / pageSize);
 *
 *     return {
 *       items: orders.map(this.toDto),
 *       total,
 *       page,
 *       pageSize,
 *       totalPages,
 *       hasNextPage: page < totalPages,
 *       hasPreviousPage: page > 1,
 *     };
 *   }
 *
 *   private toDto(order: Order): OrderDto {
 *     return {
 *       id: order.id,
 *       customerId: order.customerId,
 *       status: order.status,
 *       total: order.total,
 *       itemCount: order.items.length,
 *       createdAt: order.createdAt.toISOString(),
 *     };
 *   }
 * }
 * ```
 */
export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult = unknown> {
  /**
   * Execute the query and return a result.
   *
   * This method contains the logic for fetching and transforming data.
   * It should be optimized for read performance and may use caching.
   *
   * @param query - The query to execute
   * @param context - Optional execution context with tracing and cancellation support
   * @returns Promise resolving to the query result
   *
   * @example
   * ```typescript
   * async execute(query: SearchProductsQuery, context?: HandlerContext): Promise<SearchResult<Product>> {
   *   const { searchTerm, filters, limit, offset } = query;
   *
   *   // Check cancellation for long-running searches
   *   if (context?.isCancelled()) {
   *     return { items: [], total: 0, took: 0 };
   *   }
   *
   *   const startTime = Date.now();
   *
   *   const results = await this.searchService.search({
   *     query: searchTerm,
   *     filters,
   *     from: offset,
   *     size: limit,
   *   });
   *
   *   return {
   *     items: results.hits,
   *     total: results.total,
   *     took: Date.now() - startTime,
   *   };
   * }
   * ```
   */
  execute(query: TQuery, context?: HandlerContext): Promise<TResult>;
}

/**
 * Abstract base class for command handlers with common utilities.
 *
 * Provides logging, validation, and error handling boilerplate.
 *
 * @template TCommand - The command type this handler processes
 * @template TResult - The type of result returned by the handler
 *
 * @example
 * ```typescript
 * class UpdateUserHandler extends CommandHandlerBase<UpdateUserCommand, User> {
 *   constructor(
 *     logger: ILogger,
 *     private readonly userRepository: IUserRepository,
 *   ) {
 *     super(logger);
 *   }
 *
 *   protected async doExecute(command: UpdateUserCommand): Promise<User> {
 *     const user = await this.userRepository.findById(command.userId);
 *     if (!user) {
 *       throw new NotFoundError('User not found');
 *     }
 *
 *     return this.userRepository.update(command.userId, command.updates);
 *   }
 *
 *   protected validate(command: UpdateUserCommand): void {
 *     if (!command.userId) {
 *       throw new ValidationError('User ID is required');
 *     }
 *   }
 * }
 * ```
 */
export abstract class CommandHandlerBase<TCommand extends ICommand<TResult>, TResult = void>
  implements ICommandHandler<TCommand, TResult>
{
  /**
   * Logger instance for this handler.
   */
  protected readonly logger: IHandlerLogger;

  /**
   * Creates a new command handler instance.
   *
   * @param logger - Logger instance for logging operations
   */
  protected constructor(logger: IHandlerLogger) {
    this.logger = logger;
  }

  /**
   * Execute the command with logging and error handling.
   *
   * @param command - The command to execute
   * @param context - Optional execution context
   * @returns Promise resolving to the command result
   */
  async execute(command: TCommand, context?: HandlerContext): Promise<TResult> {
    const startTime = Date.now();
    const commandType = command.constructor.name || 'UnknownCommand';
    const commandMetadata = (command as unknown as { metadata?: CommandMetadata }).metadata;

    this.logger.debug(`Executing ${commandType}`, {
      traceId: context?.traceId,
      commandId: commandMetadata?.commandId,
    });

    try {
      // Validate before execution
      this.validate(command);

      // Execute the actual logic
      const result = await this.doExecute(command, context);

      const duration = Date.now() - startTime;
      this.logger.info(`${commandType} completed`, {
        traceId: context?.traceId,
        commandId: commandMetadata?.commandId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${commandType} failed`, error as Error, {
        traceId: context?.traceId,
        commandId: commandMetadata?.commandId,
        duration,
      });
      throw error;
    }
  }

  /**
   * Implement the actual command execution logic.
   *
   * @param command - The command to execute
   * @param context - Optional execution context
   * @returns Promise resolving to the command result
   */
  protected abstract doExecute(command: TCommand, context?: HandlerContext): Promise<TResult>;

  /**
   * Validate the command before execution.
   *
   * Override this method to add custom validation logic.
   *
   * @param command - The command to validate
   * @throws {ValidationError} If validation fails
   */
  protected validate(_command: TCommand): void {
    // Override in subclasses for custom validation
  }
}

/**
 * Abstract base class for query handlers with common utilities.
 *
 * Provides logging, caching support, and error handling boilerplate.
 *
 * @template TQuery - The query type this handler processes
 * @template TResult - The type of result returned by the handler
 *
 * @example
 * ```typescript
 * class GetUserByEmailHandler extends QueryHandlerBase<GetUserByEmailQuery, User | null> {
 *   constructor(
 *     logger: ILogger,
 *     private readonly userRepository: IUserRepository,
 *   ) {
 *     super(logger);
 *   }
 *
 *   protected async doExecute(query: GetUserByEmailQuery): Promise<User | null> {
 *     return this.userRepository.findByEmail(query.email);
 *   }
 *
 *   protected getCacheKey(query: GetUserByEmailQuery): string | undefined {
 *     return `user:email:${query.email}`;
 *   }
 *
 *   protected getCacheTTL(): number {
 *     return 300; // 5 minutes
 *   }
 * }
 * ```
 */
export abstract class QueryHandlerBase<TQuery extends IQuery<TResult>, TResult = unknown>
  implements IQueryHandler<TQuery, TResult>
{
  /**
   * Logger instance for this handler.
   */
  protected readonly logger: IHandlerLogger;

  /**
   * Creates a new query handler instance.
   *
   * @param logger - Logger instance for logging operations
   */
  protected constructor(logger: IHandlerLogger) {
    this.logger = logger;
  }

  /**
   * Execute the query with logging.
   *
   * @param query - The query to execute
   * @param context - Optional execution context
   * @returns Promise resolving to the query result
   */
  async execute(query: TQuery, context?: HandlerContext): Promise<TResult> {
    const startTime = Date.now();
    const queryType = query.constructor.name || 'UnknownQuery';
    const queryMetadata = (query as unknown as { metadata?: QueryMetadata }).metadata;

    this.logger.debug(`Executing ${queryType}`, {
      traceId: context?.traceId,
      queryId: queryMetadata?.queryId,
    });

    try {
      const result = await this.doExecute(query, context);

      const duration = Date.now() - startTime;
      this.logger.debug(`${queryType} completed`, {
        traceId: context?.traceId,
        queryId: queryMetadata?.queryId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${queryType} failed`, error as Error, {
        traceId: context?.traceId,
        queryId: queryMetadata?.queryId,
        duration,
      });
      throw error;
    }
  }

  /**
   * Implement the actual query execution logic.
   *
   * @param query - The query to execute
   * @param context - Optional execution context
   * @returns Promise resolving to the query result
   */
  protected abstract doExecute(query: TQuery, context?: HandlerContext): Promise<TResult>;

  /**
   * Get cache key for this query.
   *
   * Override to enable caching. Return undefined to disable caching.
   *
   * @param query - The query to get cache key for
   * @returns Cache key string or undefined
   */
  protected getCacheKey(_query: TQuery): string | undefined {
    return undefined;
  }

  /**
   * Get cache TTL in seconds.
   *
   * @returns TTL in seconds
   */
  protected getCacheTTL(): number {
    return 60;
  }
}

/**
 * Minimal logger interface required by handler base classes.
 *
 * Compatible with @struktos/core ILogger interface.
 */
export interface IHandlerLogger {
  /**
   * Log debug message.
   */
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log info message.
   */
  info(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log error message.
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
}

/**
 * Handler decorator metadata for automatic registration.
 *
 * Used by DI containers to automatically register handlers
 * based on decorated metadata.
 *
 * @example
 * ```typescript
 * // Decorator implementation (in DI adapter)
 * function CommandHandler(commandType: new (...args: any[]) => ICommand<any>) {
 *   return function (target: any) {
 *     Reflect.defineMetadata('cqrs:commandType', commandType, target);
 *   };
 * }
 *
 * // Usage
 * @CommandHandler(CreateUserCommand)
 * class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
 *   // ...
 * }
 * ```
 */
export interface HandlerMetadata {
  /**
   * The command or query type this handler processes.
   */
  handlerFor: string | (new (...args: unknown[]) => ICommand<unknown> | IQuery<unknown>);

  /**
   * Handler type: 'command' or 'query'.
   */
  type: 'command' | 'query';

  /**
   * Handler class reference.
   */
  handlerClass: new (...args: unknown[]) => ICommandHandler<ICommand<unknown>, unknown> | IQueryHandler<IQuery<unknown>, unknown>;
}

/**
 * Pipeline behavior interface for cross-cutting concerns.
 *
 * Pipeline behaviors wrap around handler execution, similar to
 * middleware but specifically for CQRS handlers.
 *
 * @template TRequest - Command or Query type
 * @template TResponse - Result type
 *
 * @example
 * ```typescript
 * // Logging behavior
 * class LoggingBehavior<TRequest, TResponse> implements IPipelineBehavior<TRequest, TResponse> {
 *   constructor(private readonly logger: ILogger) {}
 *
 *   async handle(
 *     request: TRequest,
 *     next: () => Promise<TResponse>
 *   ): Promise<TResponse> {
 *     const requestName = request.constructor.name;
 *     this.logger.info(`Handling ${requestName}`);
 *
 *     const response = await next();
 *
 *     this.logger.info(`Handled ${requestName}`);
 *     return response;
 *   }
 * }
 *
 * // Validation behavior
 * class ValidationBehavior<TRequest, TResponse> implements IPipelineBehavior<TRequest, TResponse> {
 *   constructor(private readonly validators: IValidator<TRequest>[]) {}
 *
 *   async handle(
 *     request: TRequest,
 *     next: () => Promise<TResponse>
 *   ): Promise<TResponse> {
 *     const errors = await Promise.all(
 *       this.validators.map(v => v.validate(request))
 *     );
 *
 *     const failures = errors.flat().filter(Boolean);
 *     if (failures.length > 0) {
 *       throw new ValidationException(failures);
 *     }
 *
 *     return next();
 *   }
 * }
 * ```
 */
export interface IPipelineBehavior<TRequest = unknown, TResponse = unknown> {
  /**
   * Handle the request with access to the next behavior/handler.
   *
   * @param request - The command or query being processed
   * @param next - Function to call the next behavior or final handler
   * @param context - Execution context
   * @returns Promise resolving to the response
   */
  handle(
    request: TRequest,
    next: () => Promise<TResponse>,
    context?: HandlerContext
  ): Promise<TResponse>;
}

/**
 * Dependency injection token for command handlers.
 *
 * @example
 * ```typescript
 * container.registerAll(COMMAND_HANDLERS_TOKEN, [
 *   CreateUserHandler,
 *   UpdateUserHandler,
 *   DeleteUserHandler,
 * ]);
 * ```
 */
export const COMMAND_HANDLERS_TOKEN = Symbol('CommandHandlers');

/**
 * Dependency injection token for query handlers.
 *
 * @example
 * ```typescript
 * container.registerAll(QUERY_HANDLERS_TOKEN, [
 *   GetUserByIdHandler,
 *   ListUsersHandler,
 *   SearchUsersHandler,
 * ]);
 * ```
 */
export const QUERY_HANDLERS_TOKEN = Symbol('QueryHandlers');

/**
 * Dependency injection token for pipeline behaviors.
 *
 * @example
 * ```typescript
 * container.registerAll(PIPELINE_BEHAVIORS_TOKEN, [
 *   LoggingBehavior,
 *   ValidationBehavior,
 *   TransactionBehavior,
 * ]);
 * ```
 */
export const PIPELINE_BEHAVIORS_TOKEN = Symbol('PipelineBehaviors');