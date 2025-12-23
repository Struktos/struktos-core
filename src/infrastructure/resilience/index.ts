/**
 * @fileoverview Resilience Pattern Exports
 * @description
 * This module exports all resilience-related abstractions for building
 * fault-tolerant applications. These patterns help applications gracefully
 * handle failures in distributed systems.
 *
 * Resilience Patterns included:
 * - **Retry**: Automatically retry failed operations with configurable backoff
 * - **Circuit Breaker**: Prevent cascade failures by failing fast
 * - **Timeout**: Limit execution time for long-running operations
 * - **Bulkhead**: Isolate failures by limiting concurrent executions
 * - **Rate Limit**: Control request throughput to prevent overload
 * - **Fallback**: Provide alternative responses when operations fail
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/resilience
 * @version 1.0.0
 *
 * @see {@link https://learn.microsoft.com/en-us/azure/architecture/patterns/retry | Retry Pattern}
 * @see {@link https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker | Circuit Breaker Pattern}
 * @see {@link https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead | Bulkhead Pattern}
 *
 * @example
 * ```typescript
 * import {
 *   IPolicyBuilder,
 *   IResiliencePolicy,
 *   CircuitState
 * } from '@struktos/core/infrastructure/resilience';
 *
 * // Build a resilience policy using the fluent builder
 * const policy = policyBuilder
 *   .retry({
 *     maxAttempts: 3,
 *     delay: 1000,
 *     backoffMultiplier: 2,
 *     retryOn: [NetworkError, TimeoutError]
 *   })
 *   .circuitBreaker({
 *     failureThreshold: 5,
 *     breakDuration: 30000,
 *     successThreshold: 2
 *   })
 *   .timeout({ timeout: 5000 })
 *   .fallback(async () => ({ cached: true, data: defaultData }))
 *   .build();
 *
 * // Execute with resilience
 * const result = await policy.execute(async () => {
 *   return await externalService.fetchData();
 * });
 * ```
 */

export {
  // Enums
  PolicyResult,
  CircuitState,

  // DI Tokens
  RESILIENCE_POLICY_TOKEN,
  POLICY_BUILDER_TOKEN,
} from './IResiliencePolicy';

export type {
  // Core interfaces
  IResiliencePolicy,
  ICircuitBreakerPolicy,
  IPolicyBuilder,

  // Execution types
  PolicyExecutionContext,
  PolicyExecutionResult,
  PolicyStats,

  // Policy configuration options
  RetryPolicyOptions,
  CircuitBreakerOptions,
  TimeoutPolicyOptions,
  BulkheadOptions,
  RateLimitOptions,

  // Event handling
  PolicyEvent,
  PolicyEventListener,
} from './IResiliencePolicy';
