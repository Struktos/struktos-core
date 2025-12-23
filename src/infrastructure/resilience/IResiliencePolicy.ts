/**
 * @struktos/core - Resilience Policy Interface
 *
 * Provides resilience pattern abstractions including Retry, Circuit Breaker,
 * Timeout, Bulkhead, and Fallback policies. Inspired by Polly (.NET) and
 * resilience4j (Java) patterns for building fault-tolerant applications.
 *
 * @module infrastructure/resilience/IResiliencePolicy
 * @see {@link https://docs.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/ | Resilient Microservices}
 */

import type {
  IContext,
  StruktosContextData,
} from '../../domain/context/IContext';

/**
 * Policy execution result states.
 *
 * Indicates the outcome of a resilience policy execution.
 */
export enum PolicyResult {
  /** Task completed successfully */
  Success = 'SUCCESS',
  /** Task failed and all retries exhausted */
  Failure = 'FAILURE',
  /** Task was rejected due to circuit breaker being open */
  Rejected = 'REJECTED',
  /** Task timed out */
  Timeout = 'TIMEOUT',
  /** Task was cancelled */
  Cancelled = 'CANCELLED',
  /** Fallback was executed */
  Fallback = 'FALLBACK',
}

/**
 * Circuit breaker states.
 *
 * Represents the three states of a circuit breaker.
 */
export enum CircuitState {
  /** Circuit is closed, requests flow normally */
  Closed = 'CLOSED',
  /** Circuit is open, requests are rejected immediately */
  Open = 'OPEN',
  /** Circuit is testing, limited requests allowed */
  HalfOpen = 'HALF_OPEN',
}

/**
 * Execution context for resilience policies.
 *
 * Provides information about the current execution attempt
 * and utilities for policy implementations.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @example
 * ```typescript
 * policy.execute(async (ctx) => {
 *   console.log(`Attempt ${ctx.attemptNumber} of ${ctx.maxAttempts}`);
 *   if (ctx.isCancelled()) {
 *     throw new OperationCancelledError();
 *   }
 *   return await riskyOperation();
 * });
 * ```
 */
export interface PolicyExecutionContext<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Unique execution ID for this policy execution.
   */
  executionId: string;

  /**
   * Current attempt number (1-indexed).
   */
  attemptNumber: number;

  /**
   * Maximum number of attempts configured.
   */
  maxAttempts: number;

  /**
   * Time spent so far in milliseconds across all attempts.
   */
  elapsedTime: number;

  /**
   * The original request context.
   */
  requestContext?: IContext<TContext>;

  /**
   * Policy-specific metadata.
   */
  metadata: Record<string, unknown>;

  /**
   * Check if the execution has been cancelled.
   *
   * @returns True if cancelled
   */
  isCancelled(): boolean;

  /**
   * Register a cancellation callback.
   *
   * @param callback - Function to call on cancellation
   */
  onCancel(callback: () => void): void;

  /**
   * Get the last error that occurred.
   */
  lastError?: Error;

  /**
   * Get all errors that occurred.
   */
  errors: Error[];
}

/**
 * Execution result wrapper with detailed information.
 *
 * @template T - Result type
 *
 * @example
 * ```typescript
 * const result = await policy.executeWithResult(async () => fetchData());
 *
 * if (result.isSuccess) {
 *   console.log('Data:', result.value);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts');
 *   console.error('Final error:', result.error);
 * }
 * ```
 */
export interface PolicyExecutionResult<T> {
  /**
   * Whether the execution was successful.
   */
  isSuccess: boolean;

  /**
   * The result value if successful.
   */
  value?: T;

  /**
   * The final error if failed.
   */
  error?: Error;

  /**
   * The policy result state.
   */
  result: PolicyResult;

  /**
   * Number of attempts made.
   */
  attempts: number;

  /**
   * Total execution time in milliseconds.
   */
  duration: number;

  /**
   * Detailed timing for each attempt.
   */
  attemptTimings: Array<{
    attempt: number;
    duration: number;
    success: boolean;
    error?: Error;
  }>;

  /**
   * Whether a fallback was used.
   */
  fallbackUsed: boolean;

  /**
   * The policy that handled the execution.
   */
  handledBy: string;
}

/**
 * IResiliencePolicy - Core interface for resilience policies.
 *
 * A resilience policy wraps the execution of potentially failing operations
 * and provides fault-tolerance mechanisms like retries, circuit breakers,
 * timeouts, and fallbacks.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @remarks
 * Policies can be composed together using the `wrap` method to create
 * sophisticated resilience strategies:
 * - Outer policy handles failures from inner policies
 * - Typical order: Bulkhead -> Timeout -> CircuitBreaker -> Retry
 *
 * @example
 * ```typescript
 * // Simple retry policy
 * const retryPolicy = RetryPolicy.create({
 *   maxAttempts: 3,
 *   delay: 1000,
 *   backoffMultiplier: 2,
 * });
 *
 * const result = await retryPolicy.execute(async () => {
 *   return await fetchExternalApi();
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Combined policies
 * const resilientPolicy = bulkheadPolicy
 *   .wrap(timeoutPolicy)
 *   .wrap(circuitBreakerPolicy)
 *   .wrap(retryPolicy);
 *
 * const data = await resilientPolicy.execute(async () => {
 *   return await externalService.getData();
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With fallback
 * const policyWithFallback = retryPolicy.withFallback(async (error, ctx) => {
 *   logger.warn('Using fallback due to:', error);
 *   return getCachedData();
 * });
 * ```
 */
export interface IResiliencePolicy<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Name of this policy for identification and logging.
   */
  readonly name: string;

  /**
   * Type of the policy (e.g., 'retry', 'circuitBreaker', 'timeout').
   */
  readonly type: PolicyType;

  /**
   * Execute a task with this policy's resilience mechanisms.
   *
   * Applies the policy's fault-tolerance strategy (retry, circuit breaker, etc.)
   * to the given task and returns the result or throws on final failure.
   *
   * @template T - Result type of the task
   * @param task - Async function to execute
   * @param context - Optional execution context
   * @returns Promise resolving to the task result
   * @throws {PolicyExecutionError} On final failure with all error details
   *
   * @example
   * ```typescript
   * // Simple execution
   * const data = await policy.execute(async () => {
   *   return await httpClient.get('/api/data');
   * });
   *
   * // With context access
   * const result = await policy.execute(async (ctx) => {
   *   console.log(`Attempt ${ctx.attemptNumber}`);
   *   return await fetchData();
   * });
   * ```
   */
  execute<T>(
    task: (context: PolicyExecutionContext<TContext>) => Promise<T>,
    context?: IContext<TContext>,
  ): Promise<T>;

  /**
   * Execute a task and return detailed result information.
   *
   * Unlike `execute`, this method never throws and always returns
   * a result object with success/failure information.
   *
   * @template T - Result type of the task
   * @param task - Async function to execute
   * @param context - Optional execution context
   * @returns Promise resolving to detailed execution result
   *
   * @example
   * ```typescript
   * const result = await policy.executeWithResult(async () => {
   *   return await fetchData();
   * });
   *
   * if (result.isSuccess) {
   *   return result.value;
   * } else {
   *   logger.error('Execution failed', {
   *     attempts: result.attempts,
   *     duration: result.duration,
   *     error: result.error,
   *   });
   *   throw new ServiceError('Data fetch failed');
   * }
   * ```
   */
  executeWithResult<T>(
    task: (context: PolicyExecutionContext<TContext>) => Promise<T>,
    context?: IContext<TContext>,
  ): Promise<PolicyExecutionResult<T>>;

  /**
   * Wrap another policy with this policy.
   *
   * Creates a composite policy where this policy wraps the inner policy.
   * The outer policy handles failures from the inner policy.
   *
   * @param inner - Policy to wrap
   * @returns Composite policy
   *
   * @example
   * ```typescript
   * // Create layered resilience
   * const resilientPolicy = timeoutPolicy      // Outer: enforces timeout
   *   .wrap(circuitBreakerPolicy)              // Middle: prevents cascade failures
   *   .wrap(retryPolicy);                       // Inner: retries failures
   *
   * // Execution flow:
   * // timeout -> circuitBreaker -> retry -> actual task
   * ```
   */
  wrap(inner: IResiliencePolicy<TContext>): IResiliencePolicy<TContext>;

  /**
   * Add a fallback to this policy.
   *
   * When the policy ultimately fails, the fallback function is called
   * to provide a substitute value.
   *
   * @template T - Result type
   * @param fallback - Function to call on failure
   * @returns Policy with fallback
   *
   * @example
   * ```typescript
   * const policyWithFallback = retryPolicy.withFallback(
   *   async (error, ctx) => {
   *     logger.warn('Primary failed, using cache', { error, attempts: ctx.attemptNumber });
   *     return await cache.get('fallback-data');
   *   }
   * );
   *
   * // Will always return a value (from primary or fallback)
   * const data = await policyWithFallback.execute(fetchPrimaryData);
   * ```
   */
  withFallback<T>(
    fallback: (
      error: Error,
      context: PolicyExecutionContext<TContext>,
    ) => Promise<T> | T,
  ): IResiliencePolicy<TContext>;

  /**
   * Check if this policy is in a healthy state.
   *
   * For circuit breakers, returns false when open.
   * For bulkheads, returns false when at capacity.
   *
   * @returns True if the policy is ready to accept requests
   */
  isHealthy(): boolean;

  /**
   * Reset the policy state.
   *
   * For circuit breakers, closes the circuit.
   * For retry policies, resets attempt counters.
   *
   * @example
   * ```typescript
   * // After manual intervention or health check passes
   * await circuitBreaker.reset();
   * ```
   */
  reset(): Promise<void>;

  /**
   * Get current policy statistics.
   *
   * @returns Policy execution statistics
   */
  getStats(): PolicyStats;
}

/**
 * Policy type enumeration.
 */
export type PolicyType =
  | 'retry'
  | 'circuitBreaker'
  | 'timeout'
  | 'bulkhead'
  | 'fallback'
  | 'rateLimit'
  | 'cache'
  | 'composite';

/**
 * Policy execution statistics.
 *
 * @example
 * ```typescript
 * const stats = policy.getStats();
 * console.log('Success rate:', (stats.successCount / stats.totalExecutions) * 100);
 * console.log('Circuit state:', stats.circuitState);
 * ```
 */
export interface PolicyStats {
  /**
   * Total number of executions.
   */
  totalExecutions: number;

  /**
   * Number of successful executions.
   */
  successCount: number;

  /**
   * Number of failed executions.
   */
  failureCount: number;

  /**
   * Number of rejected executions (circuit open, bulkhead full).
   */
  rejectedCount: number;

  /**
   * Number of timeout executions.
   */
  timeoutCount: number;

  /**
   * Number of fallback executions.
   */
  fallbackCount: number;

  /**
   * Average execution time in milliseconds.
   */
  averageExecutionTime: number;

  /**
   * 95th percentile execution time.
   */
  p95ExecutionTime: number;

  /**
   * 99th percentile execution time.
   */
  p99ExecutionTime: number;

  /**
   * Current circuit breaker state (if applicable).
   */
  circuitState?: CircuitState;

  /**
   * Current bulkhead utilization (if applicable).
   */
  bulkheadUtilization?: {
    active: number;
    queued: number;
    maxConcurrent: number;
  };

  /**
   * Last execution timestamp.
   */
  lastExecutionTime?: Date;

  /**
   * Time window for these stats.
   */
  windowStart: Date;

  /**
   * Reset the statistics.
   */
  reset(): void;
}

/**
 * Retry policy configuration options.
 *
 * @example
 * ```typescript
 * const options: RetryPolicyOptions = {
 *   maxAttempts: 5,
 *   delay: 1000,
 *   maxDelay: 30000,
 *   backoffMultiplier: 2,
 *   jitter: true,
 *   retryOn: [NetworkError, TimeoutError],
 *   onRetry: (error, attempt) => {
 *     logger.warn(`Retry ${attempt}:`, error.message);
 *   },
 * };
 * ```
 */
export interface RetryPolicyOptions {
  /**
   * Maximum number of attempts (including initial attempt).
   * @defaultValue 3
   */
  maxAttempts?: number;

  /**
   * Initial delay between retries in milliseconds.
   * @defaultValue 1000
   */
  delay?: number;

  /**
   * Maximum delay between retries in milliseconds.
   * @defaultValue 30000
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff.
   * @defaultValue 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add random jitter to delay.
   * @defaultValue true
   */
  jitter?: boolean;

  /**
   * Jitter range as percentage of delay (0-1).
   * @defaultValue 0.2
   */
  jitterRange?: number;

  /**
   * Error types to retry on. Retries all errors if not specified.
   */
  retryOn?: Array<new (...args: unknown[]) => Error>;

  /**
   * Predicate function to determine if error should be retried.
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * Callback invoked before each retry.
   */
  onRetry?: (
    error: Error,
    attemptNumber: number,
    delay: number,
  ) => void | Promise<void>;
}

/**
 * Circuit breaker policy configuration options.
 *
 * @example
 * ```typescript
 * const options: CircuitBreakerOptions = {
 *   failureThreshold: 5,
 *   failureThresholdPercentage: 50,
 *   samplingDuration: 10000,
 *   minimumThroughput: 10,
 *   breakDuration: 30000,
 *   onStateChange: (from, to) => {
 *     logger.info(`Circuit ${from} -> ${to}`);
 *   },
 * };
 * ```
 */
export interface CircuitBreakerOptions {
  /**
   * Number of failures to trip the circuit.
   * @defaultValue 5
   */
  failureThreshold?: number;

  /**
   * Percentage of failures to trip the circuit (0-100).
   * Takes precedence over failureThreshold if both are set.
   */
  failureThresholdPercentage?: number;

  /**
   * Time window for failure counting in milliseconds.
   * @defaultValue 10000
   */
  samplingDuration?: number;

  /**
   * Minimum number of requests before considering failure percentage.
   * @defaultValue 10
   */
  minimumThroughput?: number;

  /**
   * Time the circuit stays open before testing in milliseconds.
   * @defaultValue 30000
   */
  breakDuration?: number;

  /**
   * Number of successful requests in half-open to close circuit.
   * @defaultValue 3
   */
  successThreshold?: number;

  /**
   * Callback invoked on state change.
   */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;

  /**
   * Callback invoked when circuit opens.
   */
  onOpen?: (error: Error, failureCount: number) => void;

  /**
   * Callback invoked when circuit closes.
   */
  onClose?: () => void;

  /**
   * Callback invoked when circuit transitions to half-open.
   */
  onHalfOpen?: () => void;
}

/**
 * Timeout policy configuration options.
 *
 * @example
 * ```typescript
 * const options: TimeoutPolicyOptions = {
 *   timeout: 5000,
 *   cancelOnTimeout: true,
 *   onTimeout: (elapsed) => {
 *     logger.warn(`Operation timed out after ${elapsed}ms`);
 *   },
 * };
 * ```
 */
export interface TimeoutPolicyOptions {
  /**
   * Timeout duration in milliseconds.
   */
  timeout: number;

  /**
   * Whether to cancel the operation on timeout.
   * @defaultValue true
   */
  cancelOnTimeout?: boolean;

  /**
   * Callback invoked on timeout.
   */
  onTimeout?: (elapsedTime: number) => void;
}

/**
 * Bulkhead policy configuration options.
 *
 * @example
 * ```typescript
 * const options: BulkheadOptions = {
 *   maxConcurrent: 10,
 *   maxQueue: 100,
 *   queueTimeout: 5000,
 *   onRejected: () => {
 *     metrics.increment('bulkhead.rejected');
 *   },
 * };
 * ```
 */
export interface BulkheadOptions {
  /**
   * Maximum concurrent executions.
   * @defaultValue 10
   */
  maxConcurrent?: number;

  /**
   * Maximum queue size for waiting requests.
   * @defaultValue 0 (no queue)
   */
  maxQueue?: number;

  /**
   * Maximum time to wait in queue in milliseconds.
   * @defaultValue 0 (no wait)
   */
  queueTimeout?: number;

  /**
   * Callback invoked when request is rejected.
   */
  onRejected?: () => void;

  /**
   * Callback invoked when request is queued.
   */
  onQueued?: (queuePosition: number) => void;
}

/**
 * Rate limit policy configuration options.
 *
 * @example
 * ```typescript
 * const options: RateLimitOptions = {
 *   maxRequests: 100,
 *   windowDuration: 60000, // 100 requests per minute
 *   keySelector: (ctx) => ctx.requestContext?.get('userId') || 'anonymous',
 *   onRejected: (key, remaining) => {
 *     logger.warn(`Rate limit exceeded for ${key}`);
 *   },
 * };
 * ```
 */
export interface RateLimitOptions<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Maximum requests allowed in the window.
   */
  maxRequests: number;

  /**
   * Time window duration in milliseconds.
   */
  windowDuration: number;

  /**
   * Function to extract rate limit key (e.g., user ID, IP).
   */
  keySelector?: (context: PolicyExecutionContext<TContext>) => string;

  /**
   * Callback invoked when rate limit is exceeded.
   */
  onRejected?: (key: string, remainingTime: number) => void;
}

/**
 * ICircuitBreakerPolicy - Specific interface for circuit breaker policies.
 *
 * Extends the base resilience policy with circuit breaker specific methods.
 *
 * @template TContext - Context data type
 *
 * @example
 * ```typescript
 * const circuitBreaker: ICircuitBreakerPolicy = CircuitBreakerPolicy.create({
 *   failureThreshold: 5,
 *   breakDuration: 30000,
 * });
 *
 * // Check state before execution
 * if (circuitBreaker.getState() === CircuitState.Open) {
 *   return getCachedResponse();
 * }
 *
 * // Force open during maintenance
 * circuitBreaker.isolate();
 * ```
 */
export interface ICircuitBreakerPolicy<
  TContext extends StruktosContextData = StruktosContextData,
> extends IResiliencePolicy<TContext> {
  /**
   * Get the current circuit state.
   *
   * @returns Current circuit breaker state
   */
  getState(): CircuitState;

  /**
   * Manually isolate the circuit (force open).
   *
   * Useful during maintenance or known outages.
   *
   * @example
   * ```typescript
   * // During planned maintenance
   * circuitBreaker.isolate();
   *
   * // After maintenance
   * circuitBreaker.reset();
   * ```
   */
  isolate(): void;

  /**
   * Get the time until the circuit attempts to close.
   *
   * @returns Milliseconds until half-open transition, or undefined if not open
   */
  getTimeUntilClose(): number | undefined;
}

/**
 * IPolicyBuilder - Fluent builder for composing resilience policies.
 *
 * @template TContext - Context data type
 *
 * @example
 * ```typescript
 * const policy = PolicyBuilder.create<StruktosContextData>()
 *   .retry({
 *     maxAttempts: 3,
 *     delay: 1000,
 *     backoffMultiplier: 2,
 *   })
 *   .circuitBreaker({
 *     failureThreshold: 5,
 *     breakDuration: 30000,
 *   })
 *   .timeout({ timeout: 10000 })
 *   .fallback(async () => getDefaultValue())
 *   .build();
 *
 * const result = await policy.execute(fetchData);
 * ```
 */
export interface IPolicyBuilder<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Add a retry policy.
   */
  retry(options: RetryPolicyOptions): IPolicyBuilder<TContext>;

  /**
   * Add a circuit breaker policy.
   */
  circuitBreaker(options: CircuitBreakerOptions): IPolicyBuilder<TContext>;

  /**
   * Add a timeout policy.
   */
  timeout(options: TimeoutPolicyOptions): IPolicyBuilder<TContext>;

  /**
   * Add a bulkhead policy.
   */
  bulkhead(options: BulkheadOptions): IPolicyBuilder<TContext>;

  /**
   * Add a rate limit policy.
   */
  rateLimit(options: RateLimitOptions<TContext>): IPolicyBuilder<TContext>;

  /**
   * Add a fallback.
   */
  fallback<T>(
    fallback: (
      error: Error,
      context: PolicyExecutionContext<TContext>,
    ) => Promise<T> | T,
  ): IPolicyBuilder<TContext>;

  /**
   * Build the composite policy.
   */
  build(): IResiliencePolicy<TContext>;
}

/**
 * Policy event types for monitoring and logging.
 */
export type PolicyEventType =
  | 'execution.start'
  | 'execution.success'
  | 'execution.failure'
  | 'retry.attempt'
  | 'retry.exhausted'
  | 'circuit.open'
  | 'circuit.close'
  | 'circuit.halfOpen'
  | 'circuit.rejected'
  | 'timeout.triggered'
  | 'bulkhead.rejected'
  | 'bulkhead.queued'
  | 'rateLimit.rejected'
  | 'fallback.executed';

/**
 * Policy event for monitoring.
 */
export interface PolicyEvent<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Event type.
   */
  type: PolicyEventType;

  /**
   * Policy that emitted the event.
   */
  policyName: string;

  /**
   * Policy type.
   */
  policyType: PolicyType;

  /**
   * Event timestamp.
   */
  timestamp: Date;

  /**
   * Event-specific data.
   */
  data?: {
    error?: Error;
    attemptNumber?: number;
    delay?: number;
    duration?: number;
    circuitState?: CircuitState;
    [key: string]: unknown;
  };

  /**
   * Execution context.
   */
  context?: PolicyExecutionContext<TContext>;
}

/**
 * Policy event listener function type.
 */
export type PolicyEventListener<
  TContext extends StruktosContextData = StruktosContextData,
> = (event: PolicyEvent<TContext>) => void;

/**
 * Dependency injection token for resilience policy factory.
 *
 * @example
 * ```typescript
 * container.register(RESILIENCE_POLICY_TOKEN, {
 *   useClass: DefaultResiliencePolicyFactory,
 * });
 * ```
 */
export const RESILIENCE_POLICY_TOKEN = Symbol('IResiliencePolicy');

/**
 * Dependency injection token for policy builder.
 */
export const POLICY_BUILDER_TOKEN = Symbol('IPolicyBuilder');
