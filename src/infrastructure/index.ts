/**
 * @fileoverview Infrastructure Layer Exports
 * @description
 * The Infrastructure Layer provides implementations for external concerns
 * and cross-cutting features. This layer contains abstractions for:
 *
 * - **Tracing**: Distributed tracing for observability (OpenTelemetry compatible)
 * - **Resilience**: Fault tolerance patterns (Retry, Circuit Breaker, etc.)
 * - **Persistence**: Database adapters and implementations (in separate adapters)
 * - **Messaging**: Event bus and message queue integrations (future)
 *
 * All abstractions in this layer are designed to be infrastructure-agnostic,
 * allowing different implementations (e.g., OpenTelemetry, Polly, etc.) to
 * be plugged in through dependency injection.
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   // Tracing
 *   ITracer,
 *   SpanKind,
 *
 *   // Resilience
 *   IPolicyBuilder,
 *   IResiliencePolicy
 * } from '@struktos/core/infrastructure';
 *
 * // Create a traced, resilient operation
 * async function fetchWithResilience<T>(
 *   tracer: ITracer<MyContext>,
 *   policy: IResiliencePolicy<MyContext>,
 *   url: string
 * ): Promise<T> {
 *   return tracer.withSpan('http.fetch', async (span) => {
 *     span.setAttribute('http.url', url);
 *
 *     return policy.execute(async () => {
 *       const response = await fetch(url);
 *       span.setAttribute('http.status_code', response.status);
 *       return response.json();
 *     });
 *   });
 * }
 * ```
 */

// Distributed Tracing
export * from './tracing';

// Resilience Patterns
export * from './resilience';

// Platform abstractions for middleware, request/response
export * from './platform';

// Middleware pipeline utilities and composition
export * from './pipeline';

// High-performance caching utilities
export * from './cache';
