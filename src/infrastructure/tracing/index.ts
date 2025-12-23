/**
 * @fileoverview Distributed Tracing Exports
 * @description
 * This module exports all distributed tracing abstractions for
 * observability and request tracking across microservices.
 *
 * The tracing system is compatible with OpenTelemetry standards and
 * integrates with the existing RequestContext for seamless trace
 * propagation through the application stack.
 *
 * Features:
 * - W3C Trace Context compatible trace/span IDs
 * - Span creation with attributes, events, and links
 * - Integration with RequestContext for automatic propagation
 * - Context injection/extraction for cross-service communication
 *
 * @packageDocumentation
 * @module @struktos/core/infrastructure/tracing
 * @version 1.0.0
 *
 * @see {@link https://opentelemetry.io/docs/specs/otel/ | OpenTelemetry Specification}
 * @see {@link https://www.w3.org/TR/trace-context/ | W3C Trace Context}
 *
 * @example
 * ```typescript
 * import {
 *   ITracer,
 *   SpanKind,
 *   SpanStatus
 * } from '@struktos/core/infrastructure/tracing';
 *
 * async function processOrder(tracer: ITracer<MyContext>, orderId: string) {
 *   return tracer.withSpan(
 *     'processOrder',
 *     async (span) => {
 *       span.setAttribute('order.id', orderId);
 *
 *       try {
 *         const result = await orderService.process(orderId);
 *         span.setStatus(SpanStatus.Ok);
 *         return result;
 *       } catch (error) {
 *         span.recordException(error);
 *         span.setStatus(SpanStatus.Error, error.message);
 *         throw error;
 *       }
 *     },
 *     { kind: SpanKind.Internal }
 *   );
 * }
 * ```
 */

export {
  // Enums
  SpanStatus,
  SpanKind,

  // DI Tokens
  TRACER_TOKEN,
  TRACER_FACTORY_TOKEN,
} from './ITracer';

export type {
  // Core interfaces
  ITracer,
  ISpan,
  ITracerFactory,

  // Types
  TraceContext,
  SpanOptions,
  SpanAttributes,
  SpanEvent,
  SpanLink,
  TracerOptions,
  SamplerConfig,
} from './ITracer';
