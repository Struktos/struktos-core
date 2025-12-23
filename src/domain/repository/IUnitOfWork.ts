/**
 * @struktos/core - Unit of Work Interface
 *
 * Provides transaction management abstraction inspired by Entity Framework's
 * Unit of Work pattern. Enables atomic operations across multiple repositories
 * while maintaining clean separation between domain and infrastructure layers.
 *
 * @module domain/repository/IUnitOfWork
 * @see {@link https://martinfowler.com/eaaCatalog/unitOfWork.html | Unit of Work Pattern}
 */

import type { IContext, StruktosContextData } from '../context/IContext';

/**
 * Transaction isolation levels supported by the Unit of Work.
 *
 * These levels define how transaction integrity is guaranteed
 * when multiple concurrent transactions access the same data.
 *
 * @remarks
 * Isolation level support depends on the underlying database.
 * Adapters should document which levels they support.
 */
export enum IsolationLevel {
  /**
   * Allows dirty reads, non-repeatable reads, and phantom reads.
   * Lowest overhead, suitable for read-heavy non-critical operations.
   */
  ReadUncommitted = 'READ_UNCOMMITTED',

  /**
   * Prevents dirty reads but allows non-repeatable reads and phantom reads.
   * Default level for most databases.
   */
  ReadCommitted = 'READ_COMMITTED',

  /**
   * Prevents dirty reads and non-repeatable reads but allows phantom reads.
   * Ensures consistent view within a transaction.
   */
  RepeatableRead = 'REPEATABLE_READ',

  /**
   * Highest isolation level. Prevents all phenomena.
   * Suitable for critical financial operations.
   */
  Serializable = 'SERIALIZABLE',

  /**
   * Snapshot isolation using row versioning.
   * Available in databases like PostgreSQL, SQL Server.
   */
  Snapshot = 'SNAPSHOT',
}

/**
 * Options for configuring a transaction.
 *
 * @example
 * ```typescript
 * const options: TransactionOptions = {
 *   isolationLevel: IsolationLevel.Serializable,
 *   timeout: 30000,
 *   readOnly: false,
 * };
 * await unitOfWork.start(options);
 * ```
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level.
   * @defaultValue IsolationLevel.ReadCommitted
   */
  isolationLevel?: IsolationLevel;

  /**
   * Transaction timeout in milliseconds.
   * After this time, the transaction will be automatically rolled back.
   * @defaultValue 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Whether the transaction is read-only.
   * Read-only transactions can have better performance in some databases.
   * @defaultValue false
   */
  readOnly?: boolean;

  /**
   * Savepoint name for nested transaction support.
   * If provided, creates a savepoint instead of a new transaction.
   */
  savepoint?: string;

  /**
   * Additional database-specific options.
   * Adapter implementations can use these for vendor-specific features.
   */
  databaseOptions?: Record<string, unknown>;
}

/**
 * Transaction state enumeration.
 *
 * Represents the current state of a Unit of Work transaction lifecycle.
 */
export enum TransactionState {
  /** No transaction has been started */
  Inactive = 'INACTIVE',
  /** Transaction is active and accepting operations */
  Active = 'ACTIVE',
  /** Transaction is being committed */
  Committing = 'COMMITTING',
  /** Transaction has been committed successfully */
  Committed = 'COMMITTED',
  /** Transaction is being rolled back */
  RollingBack = 'ROLLING_BACK',
  /** Transaction has been rolled back */
  RolledBack = 'ROLLED_BACK',
  /** Transaction encountered an error */
  Failed = 'FAILED',
}

/**
 * Result of a transaction completion (commit or rollback).
 *
 * @example
 * ```typescript
 * const result = await unitOfWork.commit();
 * if (result.success) {
 *   console.log(`Transaction completed in ${result.duration}ms`);
 * } else {
 *   console.error('Transaction failed:', result.error);
 * }
 * ```
 */
export interface TransactionResult {
  /**
   * Whether the transaction completed successfully.
   */
  success: boolean;

  /**
   * Duration of the transaction in milliseconds.
   */
  duration: number;

  /**
   * Error that occurred during transaction, if any.
   */
  error?: Error;

  /**
   * Number of affected rows/documents across all operations.
   */
  affectedCount?: number;

  /**
   * Trace ID from the request context for distributed tracing.
   */
  traceId?: string;
}

/**
 * Repository type token for dependency injection.
 *
 * Used to identify repository types when retrieving them from the Unit of Work.
 *
 * @template T - The repository interface type
 */
export type RepositoryToken<T> =
  | string
  | symbol
  | (new (...args: unknown[]) => T);

/**
 * IUnitOfWork - Transaction management interface for domain operations.
 *
 * The Unit of Work pattern maintains a list of objects affected by a business
 * transaction and coordinates the writing of changes. It ensures that all
 * changes within a business transaction are committed atomically.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @remarks
 * This interface should be implemented by infrastructure adapters
 * (e.g., Prisma, TypeORM, Mongoose) to provide database-specific
 * transaction management.
 *
 * @example
 * ```typescript
 * // Basic usage with transaction scope
 * const unitOfWork = container.resolve<IUnitOfWork>(UNIT_OF_WORK_TOKEN);
 *
 * try {
 *   await unitOfWork.start();
 *
 *   const userRepo = unitOfWork.getRepository<IUserRepository>('UserRepository');
 *   const orderRepo = unitOfWork.getRepository<IOrderRepository>('OrderRepository');
 *
 *   const user = await userRepo.create({ name: 'John', email: 'john@example.com' });
 *   await orderRepo.create({ userId: user.id, total: 99.99 });
 *
 *   await unitOfWork.commit();
 * } catch (error) {
 *   await unitOfWork.rollback();
 *   throw error;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using executeInTransaction helper
 * const result = await unitOfWork.executeInTransaction(async (uow) => {
 *   const userRepo = uow.getRepository<IUserRepository>('UserRepository');
 *   const user = await userRepo.create({ name: 'Jane' });
 *   return user;
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom isolation level for financial operations
 * await unitOfWork.start({
 *   isolationLevel: IsolationLevel.Serializable,
 *   timeout: 60000,
 * });
 * ```
 */
export interface IUnitOfWork<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Current state of the transaction.
   *
   * @returns Current transaction state
   *
   * @example
   * ```typescript
   * if (unitOfWork.state === TransactionState.Active) {
   *   await unitOfWork.commit();
   * }
   * ```
   */
  readonly state: TransactionState;

  /**
   * Request context associated with this Unit of Work instance.
   *
   * The context provides tracing information, user identity,
   * and cancellation signals for the transaction.
   *
   * @returns The associated request context, or undefined if not set
   */
  readonly context?: IContext<TContext>;

  /**
   * Unique identifier for this Unit of Work instance.
   *
   * Useful for logging and debugging transaction lifecycles.
   *
   * @returns UUID of this Unit of Work instance
   */
  readonly id: string;

  /**
   * Start a new transaction.
   *
   * Begins a database transaction with the specified options.
   * Must be called before any repository operations within the transaction scope.
   *
   * @param options - Transaction configuration options
   * @returns Promise that resolves when the transaction is started
   * @throws {TransactionError} If a transaction is already active
   * @throws {DatabaseConnectionError} If database connection fails
   *
   * @example
   * ```typescript
   * // Start with default options
   * await unitOfWork.start();
   *
   * // Start with custom isolation level
   * await unitOfWork.start({
   *   isolationLevel: IsolationLevel.Serializable,
   *   timeout: 60000,
   * });
   *
   * // Start read-only transaction for better performance
   * await unitOfWork.start({ readOnly: true });
   * ```
   */
  start(options?: TransactionOptions): Promise<void>;

  /**
   * Commit the current transaction.
   *
   * Persists all changes made within the transaction scope to the database.
   * After commit, the Unit of Work returns to inactive state.
   *
   * @returns Promise resolving to the transaction result
   * @throws {TransactionError} If no transaction is active
   * @throws {CommitError} If commit operation fails
   *
   * @example
   * ```typescript
   * const result = await unitOfWork.commit();
   * if (result.success) {
   *   logger.info('Transaction committed', {
   *     duration: result.duration,
   *     traceId: result.traceId,
   *   });
   * }
   * ```
   */
  commit(): Promise<TransactionResult>;

  /**
   * Rollback the current transaction.
   *
   * Reverts all changes made within the transaction scope.
   * Should be called when an error occurs or business rules are violated.
   *
   * @returns Promise resolving to the transaction result
   * @throws {TransactionError} If no transaction is active
   *
   * @example
   * ```typescript
   * try {
   *   await performBusinessLogic(unitOfWork);
   *   await unitOfWork.commit();
   * } catch (error) {
   *   await unitOfWork.rollback();
   *   throw new BusinessError('Operation failed, changes reverted', { cause: error });
   * }
   * ```
   */
  rollback(): Promise<TransactionResult>;

  /**
   * Get a repository instance within the current transaction scope.
   *
   * Returns a repository that participates in the active transaction.
   * All operations performed through this repository will be part of
   * the transaction and will be committed or rolled back together.
   *
   * @template TRepository - The repository interface type
   * @param token - Repository identifier (string, symbol, or class)
   * @returns Repository instance bound to the current transaction
   * @throws {RepositoryNotRegisteredError} If repository is not registered
   * @throws {TransactionError} If no transaction is active
   *
   * @example
   * ```typescript
   * // Get repository by string token
   * const userRepo = unitOfWork.getRepository<IUserRepository>('UserRepository');
   *
   * // Get repository by symbol token
   * const USER_REPO = Symbol('UserRepository');
   * const userRepo = unitOfWork.getRepository<IUserRepository>(USER_REPO);
   *
   * // Get repository by class reference
   * const userRepo = unitOfWork.getRepository<IUserRepository>(UserRepository);
   * ```
   */
  getRepository<TRepository>(token: RepositoryToken<TRepository>): TRepository;

  /**
   * Check if a repository is registered with this Unit of Work.
   *
   * @param token - Repository identifier
   * @returns True if the repository is registered
   *
   * @example
   * ```typescript
   * if (unitOfWork.hasRepository('UserRepository')) {
   *   const userRepo = unitOfWork.getRepository<IUserRepository>('UserRepository');
   * }
   * ```
   */
  hasRepository(token: RepositoryToken<unknown>): boolean;

  /**
   * Execute a function within a transaction scope.
   *
   * Convenience method that handles transaction lifecycle automatically.
   * Starts a transaction, executes the callback, and commits on success
   * or rolls back on failure.
   *
   * @template TResult - Return type of the callback function
   * @param callback - Function to execute within the transaction
   * @param options - Transaction configuration options
   * @returns Promise resolving to the callback result
   * @throws Rethrows any error from the callback after rollback
   *
   * @example
   * ```typescript
   * // Execute with automatic transaction management
   * const user = await unitOfWork.executeInTransaction(async (uow) => {
   *   const userRepo = uow.getRepository<IUserRepository>('UserRepository');
   *   const orderRepo = uow.getRepository<IOrderRepository>('OrderRepository');
   *
   *   const newUser = await userRepo.create({ name: 'John', email: 'john@example.com' });
   *   await orderRepo.create({ userId: newUser.id, total: 99.99 });
   *
   *   return newUser;
   * });
   *
   * // With custom options
   * const result = await unitOfWork.executeInTransaction(
   *   async (uow) => {
   *     // Critical financial operation
   *     return transferFunds(uow, fromAccount, toAccount, amount);
   *   },
   *   { isolationLevel: IsolationLevel.Serializable }
   * );
   * ```
   */
  executeInTransaction<TResult>(
    callback: (unitOfWork: IUnitOfWork<TContext>) => Promise<TResult>,
    options?: TransactionOptions,
  ): Promise<TResult>;

  /**
   * Create a savepoint within the current transaction.
   *
   * Savepoints allow partial rollback within a transaction,
   * enabling nested transaction-like behavior.
   *
   * @param name - Unique name for the savepoint
   * @returns Promise that resolves when savepoint is created
   * @throws {TransactionError} If no transaction is active
   *
   * @example
   * ```typescript
   * await unitOfWork.start();
   * await userRepo.create({ name: 'User1' });
   *
   * await unitOfWork.createSavepoint('before_order');
   * try {
   *   await orderRepo.create({ userId: 'invalid' });
   * } catch (error) {
   *   await unitOfWork.rollbackToSavepoint('before_order');
   * }
   *
   * await unitOfWork.commit(); // User1 is still created
   * ```
   */
  createSavepoint(name: string): Promise<void>;

  /**
   * Rollback to a previously created savepoint.
   *
   * Reverts all changes made after the savepoint was created,
   * while keeping changes made before the savepoint.
   *
   * @param name - Name of the savepoint to rollback to
   * @returns Promise that resolves when rollback is complete
   * @throws {SavepointNotFoundError} If savepoint doesn't exist
   * @throws {TransactionError} If no transaction is active
   *
   * @example
   * ```typescript
   * await unitOfWork.rollbackToSavepoint('before_risky_operation');
   * // Continue with the transaction...
   * ```
   */
  rollbackToSavepoint(name: string): Promise<void>;

  /**
   * Release a savepoint without rolling back.
   *
   * Removes the savepoint from the transaction, keeping all changes.
   * Useful for cleaning up savepoints when they're no longer needed.
   *
   * @param name - Name of the savepoint to release
   * @returns Promise that resolves when savepoint is released
   * @throws {SavepointNotFoundError} If savepoint doesn't exist
   *
   * @example
   * ```typescript
   * await unitOfWork.createSavepoint('checkpoint');
   * await performOperation();
   * await unitOfWork.releaseSavepoint('checkpoint'); // No longer need rollback capability
   * ```
   */
  releaseSavepoint(name: string): Promise<void>;

  /**
   * Set the request context for this Unit of Work.
   *
   * Associates a request context with the transaction for
   * tracing, logging, and cancellation support.
   *
   * @param context - Request context to associate
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   * unitOfWork.setContext(ctx);
   * ```
   */
  setContext(context: IContext<TContext>): void;

  /**
   * Dispose of the Unit of Work and release resources.
   *
   * Should be called when the Unit of Work is no longer needed.
   * If a transaction is active, it will be rolled back.
   *
   * @returns Promise that resolves when disposal is complete
   *
   * @example
   * ```typescript
   * const unitOfWork = container.resolve<IUnitOfWork>(UNIT_OF_WORK_TOKEN);
   * try {
   *   await unitOfWork.start();
   *   // ... operations
   *   await unitOfWork.commit();
   * } finally {
   *   await unitOfWork.dispose();
   * }
   * ```
   */
  dispose(): Promise<void>;
}

/**
 * Factory interface for creating Unit of Work instances.
 *
 * Use this factory when you need request-scoped Unit of Work instances,
 * typically in web request handlers or use case implementations.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @example
 * ```typescript
 * @Injectable()
 * class CreateOrderUseCase {
 *   constructor(
 *     private readonly uowFactory: IUnitOfWorkFactory,
 *   ) {}
 *
 *   async execute(input: CreateOrderInput): Promise<Order> {
 *     const unitOfWork = this.uowFactory.create();
 *
 *     return unitOfWork.executeInTransaction(async (uow) => {
 *       const orderRepo = uow.getRepository<IOrderRepository>('OrderRepository');
 *       return orderRepo.create(input);
 *     });
 *   }
 * }
 * ```
 */
export interface IUnitOfWorkFactory<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Create a new Unit of Work instance.
   *
   * @param context - Optional request context to associate with the Unit of Work
   * @returns New Unit of Work instance
   *
   * @example
   * ```typescript
   * // Create without context (will use current AsyncLocalStorage context)
   * const uow = factory.create();
   *
   * // Create with explicit context
   * const ctx = RequestContext.current();
   * const uow = factory.create(ctx);
   * ```
   */
  create(context?: IContext<TContext>): IUnitOfWork<TContext>;
}

/**
 * Dependency injection token for IUnitOfWork.
 *
 * @example
 * ```typescript
 * container.register(UNIT_OF_WORK_TOKEN, {
 *   useClass: PrismaUnitOfWork,
 * });
 * ```
 */
export const UNIT_OF_WORK_TOKEN = Symbol('IUnitOfWork');

/**
 * Dependency injection token for IUnitOfWorkFactory.
 *
 * @example
 * ```typescript
 * container.register(UNIT_OF_WORK_FACTORY_TOKEN, {
 *   useClass: PrismaUnitOfWorkFactory,
 * });
 * ```
 */
export const UNIT_OF_WORK_FACTORY_TOKEN = Symbol('IUnitOfWorkFactory');
