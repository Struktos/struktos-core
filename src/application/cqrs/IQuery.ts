/**
 * @struktos/core - CQRS Query Interface
 *
 * Provides Query abstractions for the CQRS (Command Query Responsibility Segregation)
 * pattern. Queries represent requests to read data without modifying state
 * and are handled by corresponding QueryHandlers.
 *
 * @module application/cqrs/IQuery
 * @see {@link https://martinfowler.com/bliki/CQRS.html | CQRS Pattern}
 */

import type {
  IContext,
  StruktosContextData,
} from '../../domain/context/IContext';

/**
 * Base query metadata interface.
 *
 * Contains information about the query instance for caching,
 * tracing, and debugging purposes.
 *
 * @example
 * ```typescript
 * const metadata: QueryMetadata = {
 *   queryId: 'qry-123-456',
 *   queryType: 'GetUserByIdQuery',
 *   timestamp: new Date(),
 *   correlationId: 'trace-789',
 *   userId: 'user-456',
 *   cached: true,
 *   cacheTTL: 300,
 * };
 * ```
 */
export interface QueryMetadata {
  /**
   * Unique identifier for this query instance.
   * Generated automatically if not provided.
   */
  queryId: string;

  /**
   * The type name of the query (e.g., 'GetUserByIdQuery').
   * Used for routing, logging, and cache key generation.
   */
  queryType: string;

  /**
   * Timestamp when the query was created.
   */
  timestamp: Date;

  /**
   * Correlation ID for distributed tracing.
   * Links this query to related commands and queries across services.
   */
  correlationId?: string;

  /**
   * ID of the user who initiated this query.
   */
  userId?: string;

  /**
   * Whether this query result can be cached.
   * @defaultValue true
   */
  cacheable?: boolean;

  /**
   * Cache time-to-live in seconds.
   * Only relevant if cacheable is true.
   * @defaultValue 60
   */
  cacheTTL?: number;

  /**
   * Custom cache key for this query.
   * If not provided, generated from query type and parameters.
   */
  cacheKey?: string;

  /**
   * Additional custom metadata fields.
   */
  [key: string]: unknown;
}

/**
 * IQuery - Marker interface for CQRS queries.
 *
 * A Query represents a request to read data from the system without
 * modifying its state. Queries are named descriptively to indicate
 * what data they return (e.g., GetUserById, ListOrders, SearchProducts).
 *
 * @template TResult - The type of result returned by the query
 *
 * @remarks
 * Queries should be:
 * - **Side-effect free**: Never modify state, only read data
 * - **Cacheable**: Results can often be cached for performance
 * - **Filterable**: Support filtering, sorting, and pagination where applicable
 * - **Optimized**: Can use read-optimized projections or denormalized views
 *
 * @example
 * ```typescript
 * // Simple query with result type
 * interface GetUserByIdQuery extends IQuery<User | null> {
 *   readonly userId: string;
 * }
 *
 * // Usage
 * const query: GetUserByIdQuery = {
 *   userId: 'user-123',
 * };
 *
 * const user = await queryBus.execute<User | null>(query);
 * ```
 *
 * @example
 * ```typescript
 * // Query with pagination
 * interface ListOrdersQuery extends IQuery<PaginatedResult<Order>> {
 *   readonly customerId?: string;
 *   readonly status?: OrderStatus;
 *   readonly page: number;
 *   readonly pageSize: number;
 *   readonly sortBy?: 'createdAt' | 'total';
 *   readonly sortOrder?: 'asc' | 'desc';
 * }
 *
 * const query: ListOrdersQuery = {
 *   customerId: 'cust-123',
 *   status: OrderStatus.Pending,
 *   page: 1,
 *   pageSize: 20,
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc',
 * };
 *
 * const result = await queryBus.execute<PaginatedResult<Order>>(query);
 * console.log(`Found ${result.total} orders, showing ${result.items.length}`);
 * ```
 *
 * @example
 * ```typescript
 * // Search query with full-text search
 * interface SearchProductsQuery extends IQuery<SearchResult<Product>> {
 *   readonly searchTerm: string;
 *   readonly filters?: {
 *     category?: string;
 *     minPrice?: number;
 *     maxPrice?: number;
 *     inStock?: boolean;
 *   };
 *   readonly limit?: number;
 *   readonly offset?: number;
 * }
 * ```
 */
export interface IQuery<TResult = unknown> {
  /**
   * Phantom property to capture the result type.
   * This property doesn't exist at runtime but enables TypeScript
   * to infer the result type from the query.
   *
   * @internal
   */
  readonly __resultType?: TResult;
}

/**
 * Abstract base class for queries with metadata support.
 *
 * Provides a convenient base for query implementations that need
 * built-in metadata, caching configuration, and serialization support.
 *
 * @template TResult - The type of result returned by the query
 *
 * @example
 * ```typescript
 * class GetOrdersByCustomerQuery extends QueryBase<Order[]> {
 *   constructor(
 *     readonly customerId: string,
 *     readonly includeItems: boolean = false,
 *   ) {
 *     super({
 *       cacheable: true,
 *       cacheTTL: 120, // 2 minutes
 *     });
 *   }
 *
 *   // Custom cache key based on parameters
 *   getCacheKey(): string {
 *     return `orders:customer:${this.customerId}:items:${this.includeItems}`;
 *   }
 * }
 *
 * // Usage
 * const query = new GetOrdersByCustomerQuery('cust-123', true);
 * console.log(query.metadata.queryId); // Auto-generated UUID
 * console.log(query.getCacheKey()); // 'orders:customer:cust-123:items:true'
 * ```
 */
export abstract class QueryBase<TResult = unknown> implements IQuery<TResult> {
  /**
   * Query metadata including ID, type, and caching configuration.
   */
  readonly metadata: QueryMetadata;

  /**
   * Creates a new query instance with auto-generated metadata.
   *
   * @param options - Optional metadata overrides
   */
  protected constructor(
    options?: Partial<
      Pick<
        QueryMetadata,
        'cacheable' | 'cacheTTL' | 'cacheKey' | 'correlationId'
      >
    >,
  ) {
    this.metadata = {
      queryId: this.generateId(),
      queryType: this.constructor.name,
      timestamp: new Date(),
      cacheable: options?.cacheable ?? true,
      cacheTTL: options?.cacheTTL ?? 60,
      cacheKey: options?.cacheKey,
      correlationId: options?.correlationId,
    };
  }

  /**
   * Generate a cache key for this query.
   *
   * Override this method to provide custom cache key generation
   * based on query parameters.
   *
   * @returns Cache key string
   *
   * @example
   * ```typescript
   * getCacheKey(): string {
   *   return `${this.metadata.queryType}:${this.userId}`;
   * }
   * ```
   */
  getCacheKey(): string {
    return this.metadata.cacheKey ?? this.metadata.queryType;
  }

  /**
   * Generate a unique identifier for this query.
   *
   * @returns UUID string
   */
  private generateId(): string {
    return `qry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Phantom property for result type inference.
   * @internal
   */
  readonly __resultType?: TResult;
}

/**
 * Query execution options.
 *
 * Configure how a query should be executed by the query bus.
 *
 * @example
 * ```typescript
 * const options: QueryExecutionOptions = {
 *   timeout: 10000,
 *   skipCache: false,
 *   context: RequestContext.current(),
 * };
 *
 * const result = await queryBus.execute(query, options);
 * ```
 */
export interface QueryExecutionOptions<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Maximum time in milliseconds to wait for query execution.
   * @defaultValue 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Whether to bypass cache and fetch fresh data.
   * @defaultValue false
   */
  skipCache?: boolean;

  /**
   * Whether to refresh the cache with the fetched result.
   * Only applies when skipCache is true.
   * @defaultValue true
   */
  refreshCache?: boolean;

  /**
   * Request context to use for execution.
   * Provides tracing, user identity, and cancellation support.
   */
  context?: IContext<TContext>;

  /**
   * Custom cache key override.
   * If provided, overrides the query's default cache key.
   */
  cacheKey?: string;

  /**
   * Custom cache TTL override in seconds.
   */
  cacheTTL?: number;

  /**
   * Whether to execute the query in a read replica.
   * Only applicable for databases with read replicas.
   * @defaultValue true
   */
  useReadReplica?: boolean;
}

/**
 * Query execution result wrapper.
 *
 * Provides additional information about the query execution
 * beyond just the result value.
 *
 * @template TResult - The type of the actual result value
 *
 * @example
 * ```typescript
 * const result = await queryBus.executeWithMetrics(query);
 *
 * console.log('Query:', result.queryId);
 * console.log('Duration:', result.duration, 'ms');
 * console.log('From cache:', result.fromCache);
 * console.log('Result:', result.value);
 * ```
 */
export interface QueryResult<TResult> {
  /**
   * The unique ID of the executed query.
   */
  queryId: string;

  /**
   * The query type name.
   */
  queryType: string;

  /**
   * Whether the query executed successfully.
   */
  success: boolean;

  /**
   * The result value from the query handler.
   * Only present if success is true.
   */
  value?: TResult;

  /**
   * Error information if the query failed.
   * Only present if success is false.
   */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  /**
   * Whether the result was served from cache.
   */
  fromCache: boolean;

  /**
   * Cache key used (if caching was involved).
   */
  cacheKey?: string;

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
 * Standard pagination parameters for list queries.
 *
 * @example
 * ```typescript
 * interface ListUsersQuery extends IQuery<PaginatedResult<User>> {
 *   pagination: PaginationParams;
 *   filter?: { role?: string; active?: boolean };
 * }
 *
 * const query: ListUsersQuery = {
 *   pagination: {
 *     page: 1,
 *     pageSize: 20,
 *     sortBy: 'createdAt',
 *     sortOrder: 'desc',
 *   },
 *   filter: { active: true },
 * };
 * ```
 */
export interface PaginationParams {
  /**
   * Current page number (1-indexed).
   * @defaultValue 1
   */
  page: number;

  /**
   * Number of items per page.
   * @defaultValue 20
   */
  pageSize: number;

  /**
   * Field to sort by.
   */
  sortBy?: string;

  /**
   * Sort direction.
   * @defaultValue 'asc'
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Standard paginated result structure for list queries.
 *
 * @template T - The type of items in the result
 *
 * @example
 * ```typescript
 * const result: PaginatedResult<User> = {
 *   items: users,
 *   total: 150,
 *   page: 1,
 *   pageSize: 20,
 *   totalPages: 8,
 *   hasNextPage: true,
 *   hasPreviousPage: false,
 * };
 * ```
 */
export interface PaginatedResult<T> {
  /**
   * Array of items for the current page.
   */
  items: T[];

  /**
   * Total number of items across all pages.
   */
  total: number;

  /**
   * Current page number (1-indexed).
   */
  page: number;

  /**
   * Number of items per page.
   */
  pageSize: number;

  /**
   * Total number of pages.
   */
  totalPages: number;

  /**
   * Whether there is a next page.
   */
  hasNextPage: boolean;

  /**
   * Whether there is a previous page.
   */
  hasPreviousPage: boolean;
}

/**
 * IQueryBus - Central dispatcher for query execution.
 *
 * The query bus routes queries to their appropriate handlers
 * and manages cross-cutting concerns like caching, logging,
 * and performance monitoring.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @remarks
 * The query bus is typically implemented as a singleton and
 * injected into controllers, resolvers, or other read endpoints.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class UserController {
 *   constructor(private readonly queryBus: IQueryBus) {}
 *
 *   async getUser(userId: string): Promise<User | null> {
 *     const query: GetUserByIdQuery = { userId };
 *     return this.queryBus.execute<User | null>(query);
 *   }
 *
 *   async listUsers(params: ListParams): Promise<PaginatedResult<User>> {
 *     const query: ListUsersQuery = {
 *       pagination: params,
 *       filter: params.filter,
 *     };
 *     return this.queryBus.execute<PaginatedResult<User>>(query);
 *   }
 * }
 * ```
 */
export interface IQueryBus<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Execute a query and return its result.
   *
   * Routes the query to the appropriate handler. May return
   * cached result if caching is enabled and cache is valid.
   *
   * @template TResult - The expected result type
   * @param query - The query to execute
   * @param options - Execution options
   * @returns Promise resolving to the query result
   * @throws {QueryHandlerNotFoundError} If no handler is registered
   * @throws {QueryExecutionError} If handler throws an error
   *
   * @example
   * ```typescript
   * // Simple query execution
   * const user = await queryBus.execute<User | null>({
   *   __type: 'GetUserByIdQuery',
   *   userId: 'user-123',
   * });
   *
   * // With options
   * const freshData = await queryBus.execute<User[]>(listQuery, {
   *   skipCache: true,
   *   timeout: 5000,
   * });
   * ```
   */
  execute<TResult>(
    query: IQuery<TResult>,
    options?: QueryExecutionOptions<TContext>,
  ): Promise<TResult>;

  /**
   * Execute a query and return detailed result information.
   *
   * Returns a wrapper with execution metadata including
   * caching status, timing, and error details.
   *
   * @template TResult - The expected result type
   * @param query - The query to execute
   * @param options - Execution options
   * @returns Promise resolving to the query result wrapper
   *
   * @example
   * ```typescript
   * const result = await queryBus.executeWithMetrics<User>(query);
   *
   * if (result.success) {
   *   console.log('User:', result.value);
   *   console.log('From cache:', result.fromCache);
   *   console.log('Duration:', result.duration, 'ms');
   * } else {
   *   console.error('Query failed:', result.error?.message);
   * }
   * ```
   */
  executeWithMetrics<TResult>(
    query: IQuery<TResult>,
    options?: QueryExecutionOptions<TContext>,
  ): Promise<QueryResult<TResult>>;

  /**
   * Register a query handler for a specific query type.
   *
   * @param queryType - The query type name or constructor
   * @param handler - The handler instance or factory
   *
   * @example
   * ```typescript
   * queryBus.register('GetUserByIdQuery', new GetUserByIdHandler(userRepo));
   *
   * // Or with constructor
   * queryBus.register(GetUserByIdQuery, getUserHandler);
   * ```
   */
  register<TQuery extends IQuery<TResult>, TResult>(
    queryType: string | (new (...args: unknown[]) => TQuery),
    handler: IQueryHandler<TQuery, TResult>,
  ): void;

  /**
   * Check if a handler is registered for a query type.
   *
   * @param queryType - The query type name or constructor
   * @returns True if a handler is registered
   *
   * @example
   * ```typescript
   * if (!queryBus.hasHandler('GetUserByIdQuery')) {
   *   queryBus.register('GetUserByIdQuery', new GetUserByIdHandler());
   * }
   * ```
   */
  hasHandler(
    queryType: string | (new (...args: unknown[]) => IQuery<unknown>),
  ): boolean;

  /**
   * Invalidate cached results for a specific query type or key.
   *
   * @param queryTypeOrKey - Query type name, constructor, or cache key pattern
   *
   * @example
   * ```typescript
   * // Invalidate all cached results for a query type
   * await queryBus.invalidateCache('GetUserByIdQuery');
   *
   * // Invalidate specific cache key
   * await queryBus.invalidateCache('users:user-123');
   *
   * // Invalidate with pattern (if supported by cache implementation)
   * await queryBus.invalidateCache('users:*');
   * ```
   */
  invalidateCache(
    queryTypeOrKey: string | (new (...args: unknown[]) => IQuery<unknown>),
  ): Promise<void>;
}

/**
 * Forward declaration of IQueryHandler for IQueryBus interface.
 * Full definition is in IHandler.ts.
 *
 * @template TQuery - The query type this handler processes
 * @template TResult - The type of result returned by the handler
 */
export interface IQueryHandler<
  TQuery extends IQuery<TResult>,
  TResult = unknown,
> {
  /**
   * Execute the query and return a result.
   *
   * @param query - The query to execute
   * @returns Promise resolving to the query result
   */
  execute(query: TQuery): Promise<TResult>;
}

/**
 * Dependency injection token for IQueryBus.
 *
 * @example
 * ```typescript
 * container.register(QUERY_BUS_TOKEN, {
 *   useClass: CachedQueryBus,
 * });
 * ```
 */
export const QUERY_BUS_TOKEN = Symbol('IQueryBus');
