/**
 * @struktos/core - CQRS Command Interface
 *
 * Provides Command abstractions for the CQRS (Command Query Responsibility Segregation)
 * pattern. Commands represent intentions to modify the system state and are handled
 * by corresponding CommandHandlers.
 *
 * @module application/cqrs/ICommand
 * @see {@link https://martinfowler.com/bliki/CQRS.html | CQRS Pattern}
 */

import type { IContext, StruktosContextData } from '../../domain/context/IContext';

/**
 * Base command metadata interface.
 *
 * Contains information about the command instance for auditing,
 * tracing, and debugging purposes.
 *
 * @example
 * ```typescript
 * const metadata: CommandMetadata = {
 *   commandId: 'cmd-123-456',
 *   commandType: 'CreateUserCommand',
 *   timestamp: new Date(),
 *   correlationId: 'trace-789',
 *   causationId: 'previous-event-123',
 *   userId: 'user-456',
 * };
 * ```
 */
export interface CommandMetadata {
  /**
   * Unique identifier for this command instance.
   * Generated automatically if not provided.
   */
  commandId: string;

  /**
   * The type name of the command (e.g., 'CreateUserCommand').
   * Used for routing and logging.
   */
  commandType: string;

  /**
   * Timestamp when the command was created.
   */
  timestamp: Date;

  /**
   * Correlation ID for distributed tracing.
   * Links this command to related commands and queries across services.
   */
  correlationId?: string;

  /**
   * ID of the event or command that caused this command.
   * Useful for tracking command chains and debugging.
   */
  causationId?: string;

  /**
   * ID of the user who initiated this command.
   */
  userId?: string;

  /**
   * Additional custom metadata fields.
   */
  [key: string]: unknown;
}

/**
 * ICommand - Marker interface for CQRS commands.
 *
 * A Command represents an intention to change the system state.
 * Commands are named using imperative verbs (e.g., CreateUser, UpdateOrder).
 * Each command should have a corresponding CommandHandler that executes it.
 *
 * @template TResult - The type of result returned after command execution
 *
 * @remarks
 * Commands should be:
 * - **Immutable**: Once created, command data should not change
 * - **Task-based**: Represent a specific user intention or task
 * - **Validated**: Include validation logic or be validated by handlers
 * - **Idempotent**: When possible, executing the same command twice should have the same effect
 *
 * @example
 * ```typescript
 * // Simple command with result type
 * interface CreateUserCommand extends ICommand<User> {
 *   readonly name: string;
 *   readonly email: string;
 *   readonly role: UserRole;
 * }
 *
 * // Usage
 * const command: CreateUserCommand = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   role: UserRole.Member,
 * };
 *
 * const user = await commandBus.execute<User>(command);
 * ```
 *
 * @example
 * ```typescript
 * // Command with void result (fire-and-forget)
 * interface SendNotificationCommand extends ICommand<void> {
 *   readonly userId: string;
 *   readonly message: string;
 *   readonly channel: 'email' | 'sms' | 'push';
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Command class with built-in validation
 * class TransferFundsCommand implements ICommand<TransferResult> {
 *   constructor(
 *     readonly fromAccountId: string,
 *     readonly toAccountId: string,
 *     readonly amount: number,
 *     readonly currency: string = 'USD',
 *   ) {
 *     this.validate();
 *   }
 *
 *   private validate(): void {
 *     if (this.amount <= 0) {
 *       throw new ValidationError('Amount must be positive');
 *     }
 *     if (this.fromAccountId === this.toAccountId) {
 *       throw new ValidationError('Cannot transfer to same account');
 *     }
 *   }
 * }
 * ```
 */
export interface ICommand<TResult = void> {
  /**
   * Phantom property to capture the result type.
   * This property doesn't exist at runtime but enables TypeScript
   * to infer the result type from the command.
   *
   * @internal
   */
  readonly __resultType?: TResult;
}

/**
 * Abstract base class for commands with metadata support.
 *
 * Provides a convenient base for command implementations that need
 * built-in metadata, validation, and serialization support.
 *
 * @template TResult - The type of result returned after command execution
 *
 * @example
 * ```typescript
 * class CreateOrderCommand extends CommandBase<Order> {
 *   constructor(
 *     readonly customerId: string,
 *     readonly items: OrderItem[],
 *     readonly shippingAddress: Address,
 *   ) {
 *     super();
 *   }
 *
 *   protected validate(): void {
 *     if (!this.items.length) {
 *       throw new ValidationError('Order must have at least one item');
 *     }
 *   }
 * }
 *
 * // Usage
 * const command = new CreateOrderCommand('cust-123', items, address);
 * console.log(command.metadata.commandId); // Auto-generated UUID
 * console.log(command.metadata.commandType); // 'CreateOrderCommand'
 * ```
 */
export abstract class CommandBase<TResult = void> implements ICommand<TResult> {
  /**
   * Command metadata including ID, type, and timestamps.
   */
  readonly metadata: CommandMetadata;

  /**
   * Creates a new command instance with auto-generated metadata.
   *
   * @param correlationId - Optional correlation ID for distributed tracing
   */
  protected constructor(correlationId?: string) {
    this.metadata = {
      commandId: this.generateId(),
      commandType: this.constructor.name,
      timestamp: new Date(),
      correlationId,
    };
    this.validate();
  }

  /**
   * Validate the command data.
   *
   * Override this method to add custom validation logic.
   * Called automatically in the constructor.
   *
   * @throws {ValidationError} If validation fails
   *
   * @example
   * ```typescript
   * protected validate(): void {
   *   if (!this.email.includes('@')) {
   *     throw new ValidationError('Invalid email format');
   *   }
   * }
   * ```
   */
  protected validate(): void {
    // Override in subclasses for custom validation
  }

  /**
   * Generate a unique identifier for this command.
   *
   * @returns UUID string
   */
  private generateId(): string {
    // Using crypto.randomUUID() pattern - adapter should provide actual implementation
    return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Phantom property for result type inference.
   * @internal
   */
  readonly __resultType?: TResult;
}

/**
 * Command execution options.
 *
 * Configure how a command should be executed by the command bus.
 *
 * @example
 * ```typescript
 * const options: CommandExecutionOptions = {
 *   timeout: 30000,
 *   retries: 3,
 *   context: RequestContext.current(),
 * };
 *
 * await commandBus.execute(command, options);
 * ```
 */
export interface CommandExecutionOptions<TContext extends StruktosContextData = StruktosContextData> {
  /**
   * Maximum time in milliseconds to wait for command execution.
   * @defaultValue 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Number of retry attempts on transient failures.
   * @defaultValue 0 (no retries)
   */
  retries?: number;

  /**
   * Delay between retry attempts in milliseconds.
   * @defaultValue 1000
   */
  retryDelay?: number;

  /**
   * Request context to use for execution.
   * Provides tracing, user identity, and cancellation support.
   */
  context?: IContext<TContext>;

  /**
   * Priority level for command execution.
   * Higher values indicate higher priority.
   * @defaultValue 0
   */
  priority?: number;

  /**
   * Whether to execute the command asynchronously (fire-and-forget).
   * If true, execute() returns immediately without waiting for result.
   * @defaultValue false
   */
  async?: boolean;

  /**
   * Transaction isolation level for commands that modify data.
   * If provided, the command will be executed within a transaction.
   */
  transactionIsolation?: 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
}

/**
 * Command execution result wrapper.
 *
 * Provides additional information about the command execution
 * beyond just the result value.
 *
 * @template TResult - The type of the actual result value
 *
 * @example
 * ```typescript
 * const result = await commandBus.executeWithResult(command);
 *
 * console.log('Command:', result.commandId);
 * console.log('Duration:', result.duration, 'ms');
 * console.log('Result:', result.value);
 * ```
 */
export interface CommandResult<TResult> {
  /**
   * The unique ID of the executed command.
   */
  commandId: string;

  /**
   * The command type name.
   */
  commandType: string;

  /**
   * Whether the command executed successfully.
   */
  success: boolean;

  /**
   * The result value from the command handler.
   * Only present if success is true.
   */
  value?: TResult;

  /**
   * Error information if the command failed.
   * Only present if success is false.
   */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  /**
   * Execution duration in milliseconds.
   */
  duration: number;

  /**
   * Timestamp when execution started.
   */
  startedAt: Date;

  /**
   * Timestamp when execution completed.
   */
  completedAt: Date;

  /**
   * Trace ID for distributed tracing.
   */
  traceId?: string;
}

/**
 * ICommandBus - Central dispatcher for command execution.
 *
 * The command bus routes commands to their appropriate handlers
 * and manages cross-cutting concerns like logging, validation,
 * and transaction management.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @remarks
 * The command bus is typically implemented as a singleton and
 * injected into use cases, controllers, or other entry points.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderController {
 *   constructor(private readonly commandBus: ICommandBus) {}
 *
 *   async createOrder(input: CreateOrderInput): Promise<Order> {
 *     const command: CreateOrderCommand = {
 *       customerId: input.customerId,
 *       items: input.items,
 *     };
 *
 *     return this.commandBus.execute<Order>(command);
 *   }
 * }
 * ```
 */
export interface ICommandBus<TContext extends StruktosContextData = StruktosContextData> {
  /**
   * Execute a command and return its result.
   *
   * Routes the command to the appropriate handler and returns
   * the result. Throws if the command fails.
   *
   * @template TResult - The expected result type
   * @param command - The command to execute
   * @param options - Execution options
   * @returns Promise resolving to the command result
   * @throws {CommandHandlerNotFoundError} If no handler is registered
   * @throws {CommandValidationError} If command validation fails
   * @throws {CommandExecutionError} If handler throws an error
   *
   * @example
   * ```typescript
   * const user = await commandBus.execute<User>({
   *   __type: 'CreateUserCommand',
   *   name: 'John',
   *   email: 'john@example.com',
   * });
   * ```
   */
  execute<TResult>(
    command: ICommand<TResult>,
    options?: CommandExecutionOptions<TContext>
  ): Promise<TResult>;

  /**
   * Execute a command and return detailed result information.
   *
   * Similar to execute(), but returns a wrapper with execution
   * metadata instead of throwing on failure.
   *
   * @template TResult - The expected result type
   * @param command - The command to execute
   * @param options - Execution options
   * @returns Promise resolving to the command result wrapper
   *
   * @example
   * ```typescript
   * const result = await commandBus.executeWithResult<User>(command);
   *
   * if (result.success) {
   *   console.log('User created:', result.value);
   * } else {
   *   console.error('Failed:', result.error?.message);
   * }
   * ```
   */
  executeWithResult<TResult>(
    command: ICommand<TResult>,
    options?: CommandExecutionOptions<TContext>
  ): Promise<CommandResult<TResult>>;

  /**
   * Register a command handler for a specific command type.
   *
   * @param commandType - The command type name or constructor
   * @param handler - The handler instance or factory
   *
   * @example
   * ```typescript
   * commandBus.register('CreateUserCommand', new CreateUserHandler(userRepo));
   *
   * // Or with constructor
   * commandBus.register(CreateUserCommand, createUserHandler);
   * ```
   */
  register<TCommand extends ICommand<TResult>, TResult>(
    commandType: string | (new (...args: unknown[]) => TCommand),
    handler: ICommandHandler<TCommand, TResult>
  ): void;

  /**
   * Check if a handler is registered for a command type.
   *
   * @param commandType - The command type name or constructor
   * @returns True if a handler is registered
   *
   * @example
   * ```typescript
   * if (!commandBus.hasHandler('CreateUserCommand')) {
   *   commandBus.register('CreateUserCommand', new CreateUserHandler());
   * }
   * ```
   */
  hasHandler(commandType: string | (new (...args: unknown[]) => ICommand<unknown>)): boolean;
}

/**
 * Forward declaration of ICommandHandler for ICommandBus interface.
 * Full definition is in IHandler.ts.
 *
 * @template TCommand - The command type this handler processes
 * @template TResult - The type of result returned by the handler
 */
export interface ICommandHandler<TCommand extends ICommand<TResult>, TResult = void> {
  /**
   * Execute the command and return a result.
   *
   * @param command - The command to execute
   * @returns Promise resolving to the command result
   */
  execute(command: TCommand): Promise<TResult>;
}

/**
 * Dependency injection token for ICommandBus.
 *
 * @example
 * ```typescript
 * container.register(COMMAND_BUS_TOKEN, {
 *   useClass: InMemoryCommandBus,
 * });
 * ```
 */
export const COMMAND_BUS_TOKEN = Symbol('ICommandBus');