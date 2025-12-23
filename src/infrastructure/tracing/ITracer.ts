/**
 * @struktos/core - Distributed Tracing Interface
 *
 * Provides distributed tracing abstractions that integrate with RequestContext
 * for end-to-end request tracing across microservices. Compatible with
 * OpenTelemetry, Jaeger, Zipkin, and other tracing systems.
 *
 * @module infrastructure/tracing/ITracer
 * @see {@link https://opentelemetry.io/docs/concepts/signals/traces/ | OpenTelemetry Traces}
 */

import type {
  IContext,
  StruktosContextData,
} from '../../domain/context/IContext';

/**
 * Span status codes following OpenTelemetry conventions.
 *
 * Indicates the outcome of the operation represented by the span.
 */
export enum SpanStatus {
  /** The operation completed without any issues */
  Ok = 'OK',
  /** An error occurred during the operation */
  Error = 'ERROR',
  /** The status is not set (default) */
  Unset = 'UNSET',
}

/**
 * Span kind indicating the role of the span in the trace.
 *
 * @remarks
 * - **Server**: The span covers server-side handling of a request
 * - **Client**: The span covers the client-side of a request to a server
 * - **Producer**: The span covers the creation of a message to a queue
 * - **Consumer**: The span covers the processing of a message from a queue
 * - **Internal**: The span represents an internal operation
 */
export enum SpanKind {
  /** Server-side handling of an RPC or HTTP request */
  Server = 'SERVER',
  /** Client-side of an RPC or HTTP request */
  Client = 'CLIENT',
  /** Producer side of a message queue operation */
  Producer = 'PRODUCER',
  /** Consumer side of a message queue operation */
  Consumer = 'CONSUMER',
  /** Internal operation within the same process */
  Internal = 'INTERNAL',
}

/**
 * Span attributes for adding contextual information.
 *
 * Follows OpenTelemetry semantic conventions for attribute naming.
 *
 * @example
 * ```typescript
 * const attributes: SpanAttributes = {
 *   'http.method': 'POST',
 *   'http.url': '/api/users',
 *   'http.status_code': 201,
 *   'user.id': 'user-123',
 *   'db.system': 'postgresql',
 *   'db.statement': 'SELECT * FROM users',
 * };
 * ```
 */
export interface SpanAttributes {
  /** Any string attribute */
  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | number[]
    | boolean[]
    | undefined;
}

/**
 * Span event representing a point-in-time occurrence.
 *
 * Events mark specific moments during a span's lifetime,
 * useful for logging significant occurrences.
 *
 * @example
 * ```typescript
 * const event: SpanEvent = {
 *   name: 'cache.miss',
 *   timestamp: Date.now(),
 *   attributes: {
 *     'cache.key': 'user:123',
 *     'cache.type': 'redis',
 *   },
 * };
 * ```
 */
export interface SpanEvent {
  /**
   * Name of the event.
   */
  name: string;

  /**
   * Timestamp of the event in milliseconds since epoch.
   */
  timestamp: number;

  /**
   * Event-specific attributes.
   */
  attributes?: SpanAttributes;
}

/**
 * Span link connecting this span to related spans.
 *
 * Links are used to connect causally-related spans that don't
 * have a direct parent-child relationship.
 *
 * @example
 * ```typescript
 * // Link to a batch producer span
 * const link: SpanLink = {
 *   traceId: 'abc123',
 *   spanId: 'def456',
 *   attributes: {
 *     'link.type': 'batch',
 *     'batch.size': 100,
 *   },
 * };
 * ```
 */
export interface SpanLink {
  /**
   * Trace ID of the linked span.
   */
  traceId: string;

  /**
   * Span ID of the linked span.
   */
  spanId: string;

  /**
   * Attributes describing the relationship.
   */
  attributes?: SpanAttributes;
}

/**
 * Trace context for propagating trace information across services.
 *
 * Contains the W3C Trace Context headers for distributed tracing.
 *
 * @example
 * ```typescript
 * const context: TraceContext = {
 *   traceId: 'abc123def456789',
 *   spanId: 'span123',
 *   traceFlags: 1, // Sampled
 *   traceState: 'vendor1=value1,vendor2=value2',
 * };
 *
 * // Inject into HTTP headers
 * headers['traceparent'] = `00-${context.traceId}-${context.spanId}-0${context.traceFlags}`;
 * ```
 */
export interface TraceContext {
  /**
   * Unique identifier for the entire trace.
   * 32 character hex string (128 bits).
   */
  traceId: string;

  /**
   * Unique identifier for the current span.
   * 16 character hex string (64 bits).
   */
  spanId: string;

  /**
   * Parent span ID, if this span has a parent.
   */
  parentSpanId?: string;

  /**
   * Trace flags (8-bit field).
   * Bit 0 = sampled flag (1 = sampled, 0 = not sampled).
   */
  traceFlags: number;

  /**
   * Vendor-specific trace state.
   * Comma-separated list of key=value pairs.
   */
  traceState?: string;

  /**
   * Whether this trace is being sampled.
   */
  sampled: boolean;
}

/**
 * Options for creating a new span.
 *
 * @example
 * ```typescript
 * const options: SpanOptions = {
 *   kind: SpanKind.Client,
 *   attributes: {
 *     'http.method': 'GET',
 *     'http.url': 'https://api.example.com/users',
 *   },
 *   links: [previousBatchSpan],
 *   startTime: Date.now(),
 * };
 *
 * const span = tracer.startSpan('http.request', options);
 * ```
 */
export interface SpanOptions {
  /**
   * Kind of span (Server, Client, Internal, etc.).
   * @defaultValue SpanKind.Internal
   */
  kind?: SpanKind;

  /**
   * Initial attributes for the span.
   */
  attributes?: SpanAttributes;

  /**
   * Links to related spans.
   */
  links?: SpanLink[];

  /**
   * Custom start time in milliseconds since epoch.
   * If not provided, uses current time.
   */
  startTime?: number;

  /**
   * Parent trace context for explicit parent linking.
   * If not provided, uses current context from RequestContext.
   */
  parent?: TraceContext;

  /**
   * Whether to record this span regardless of sampling decision.
   * Useful for error spans that should always be captured.
   */
  forceRecord?: boolean;
}

/**
 * ISpan - Interface for individual trace spans.
 *
 * A span represents a single operation within a trace. It has a start time,
 * duration, attributes, events, and status. Spans form a tree structure
 * with parent-child relationships.
 *
 * @remarks
 * Always end spans to ensure they are recorded. Use try/finally blocks
 * or the `withSpan` helper to ensure spans are properly ended.
 *
 * @example
 * ```typescript
 * // Manual span management
 * const span = tracer.startSpan('processOrder');
 * try {
 *   span.setAttribute('order.id', orderId);
 *
 *   const result = await processOrder(orderId);
 *
 *   span.addEvent('order.processed', {
 *     'items.count': result.itemCount,
 *   });
 *   span.setStatus(SpanStatus.Ok);
 *
 *   return result;
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus(SpanStatus.Error, error.message);
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using withSpan helper
 * const result = await tracer.withSpan('processOrder', async (span) => {
 *   span.setAttribute('order.id', orderId);
 *   return processOrder(orderId);
 * });
 * ```
 */
export interface ISpan {
  /**
   * Unique identifier for this span.
   */
  readonly spanId: string;

  /**
   * Trace ID this span belongs to.
   */
  readonly traceId: string;

  /**
   * Parent span ID, if any.
   */
  readonly parentSpanId?: string;

  /**
   * Name of this span (operation name).
   */
  readonly name: string;

  /**
   * Kind of this span.
   */
  readonly kind: SpanKind;

  /**
   * Whether this span has ended.
   */
  readonly isEnded: boolean;

  /**
   * Get the trace context for this span.
   *
   * Use this to propagate trace context to downstream services.
   *
   * @returns Trace context object
   *
   * @example
   * ```typescript
   * const ctx = span.getContext();
   * // Inject into HTTP headers
   * headers['x-trace-id'] = ctx.traceId;
   * headers['x-span-id'] = ctx.spanId;
   * ```
   */
  getContext(): TraceContext;

  /**
   * Set a single attribute on the span.
   *
   * @param key - Attribute key (use semantic conventions when applicable)
   * @param value - Attribute value
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * span.setAttribute('http.method', 'GET')
   *     .setAttribute('http.url', '/api/users')
   *     .setAttribute('http.status_code', 200);
   * ```
   */
  setAttribute(key: string, value: string | number | boolean): ISpan;

  /**
   * Set multiple attributes on the span.
   *
   * @param attributes - Object containing key-value pairs
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * span.setAttributes({
   *   'db.system': 'postgresql',
   *   'db.name': 'mydb',
   *   'db.statement': 'SELECT * FROM users WHERE id = $1',
   *   'db.operation': 'SELECT',
   * });
   * ```
   */
  setAttributes(attributes: SpanAttributes): ISpan;

  /**
   * Add an event to the span.
   *
   * Events mark significant points in time during the span's lifetime.
   *
   * @param name - Event name
   * @param attributes - Optional event attributes
   * @param timestamp - Optional timestamp (defaults to now)
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * span.addEvent('cache.lookup', { 'cache.hit': false });
   * span.addEvent('db.query.start');
   * // ... execute query
   * span.addEvent('db.query.complete', { 'rows.returned': 42 });
   * ```
   */
  addEvent(
    name: string,
    attributes?: SpanAttributes,
    timestamp?: number,
  ): ISpan;

  /**
   * Record an exception that occurred during the span.
   *
   * Automatically extracts error information and adds it as an event.
   *
   * @param error - The error/exception that occurred
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * try {
   *   await riskyOperation();
   * } catch (error) {
   *   span.recordException(error);
   *   span.setStatus(SpanStatus.Error, 'Operation failed');
   *   throw error;
   * }
   * ```
   */
  recordException(error: Error | unknown): ISpan;

  /**
   * Set the status of the span.
   *
   * @param status - Status code (Ok, Error, or Unset)
   * @param message - Optional status message (for errors)
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * // Success
   * span.setStatus(SpanStatus.Ok);
   *
   * // Error with message
   * span.setStatus(SpanStatus.Error, 'User not found');
   * ```
   */
  setStatus(status: SpanStatus, message?: string): ISpan;

  /**
   * Update the span name.
   *
   * Useful when the operation name is determined during execution.
   *
   * @param name - New span name
   * @returns This span for method chaining
   *
   * @example
   * ```typescript
   * const span = tracer.startSpan('http.request');
   * // After parsing the request
   * span.updateName(`${method} ${route}`);
   * ```
   */
  updateName(name: string): ISpan;

  /**
   * End the span.
   *
   * Records the span's end time and sends it to the exporter.
   * Must be called for the span to be recorded.
   *
   * @param endTime - Optional custom end time in milliseconds
   *
   * @example
   * ```typescript
   * const span = tracer.startSpan('operation');
   * try {
   *   await doWork();
   * } finally {
   *   span.end();
   * }
   * ```
   */
  end(endTime?: number): void;
}

/**
 * ITracer - Distributed tracing interface integrated with RequestContext.
 *
 * The tracer creates and manages spans, integrating with the Struktos
 * RequestContext for automatic context propagation. It abstracts the
 * underlying tracing implementation (OpenTelemetry, Jaeger, etc.).
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @remarks
 * The tracer automatically:
 * - Links spans to the current RequestContext
 * - Propagates trace context through AsyncLocalStorage
 * - Handles parent-child span relationships
 *
 * @example
 * ```typescript
 * // Get the tracer instance
 * const tracer = container.resolve<ITracer>(TRACER_TOKEN);
 *
 * // Create a span using the current context
 * const span = tracer.startSpan('processPayment');
 * try {
 *   span.setAttribute('payment.amount', amount);
 *   const result = await processPayment(amount);
 *   span.setStatus(SpanStatus.Ok);
 *   return result;
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using withSpan for automatic span management
 * const result = await tracer.withSpan('fetchUserData', async (span) => {
 *   span.setAttribute('user.id', userId);
 *
 *   // Child spans are automatically linked
 *   const user = await tracer.withSpan('db.query', async (childSpan) => {
 *     childSpan.setAttributes({
 *       'db.system': 'postgresql',
 *       'db.operation': 'SELECT',
 *     });
 *     return userRepository.findById(userId);
 *   });
 *
 *   return user;
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Extract and inject context for cross-service tracing
 * // Client side
 * const headers = tracer.inject({});
 * await fetch('https://api.example.com', { headers });
 *
 * // Server side
 * const context = tracer.extract(request.headers);
 * const span = tracer.startSpan('handleRequest', { parent: context });
 * ```
 */
export interface ITracer<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Name of this tracer instance.
   * Usually the service or library name.
   */
  readonly name: string;

  /**
   * Version of the tracer.
   */
  readonly version: string;

  /**
   * Start a new span.
   *
   * The span is automatically linked to the current RequestContext
   * if one exists. Use options.parent to explicitly set the parent.
   *
   * @param name - Name of the operation (e.g., 'http.request', 'db.query')
   * @param options - Optional span configuration
   * @returns New span instance
   *
   * @example
   * ```typescript
   * // Simple span
   * const span = tracer.startSpan('processOrder');
   *
   * // Span with options
   * const span = tracer.startSpan('http.client.request', {
   *   kind: SpanKind.Client,
   *   attributes: {
   *     'http.method': 'POST',
   *     'http.url': 'https://api.payment.com/charge',
   *   },
   * });
   * ```
   */
  startSpan(name: string, options?: SpanOptions): ISpan;

  /**
   * Execute a function within a new span scope.
   *
   * Automatically starts the span before the function, sets status based
   * on the result, and ends the span after (even on errors).
   *
   * @template T - Return type of the function
   * @param name - Span name
   * @param fn - Function to execute within the span
   * @param options - Optional span configuration
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * // Simple usage
   * const user = await tracer.withSpan('getUser', async (span) => {
   *   span.setAttribute('user.id', userId);
   *   return userService.findById(userId);
   * });
   *
   * // With options
   * const result = await tracer.withSpan(
   *   'external.api.call',
   *   async (span) => {
   *     const response = await fetch('https://api.example.com');
   *     span.setAttribute('http.status_code', response.status);
   *     return response.json();
   *   },
   *   { kind: SpanKind.Client }
   * );
   * ```
   */
  withSpan<T>(
    name: string,
    fn: (span: ISpan) => Promise<T> | T,
    options?: SpanOptions,
  ): Promise<T>;

  /**
   * Get the current active span from RequestContext.
   *
   * @returns Current span or undefined if none active
   *
   * @example
   * ```typescript
   * const currentSpan = tracer.getCurrentSpan();
   * if (currentSpan) {
   *   currentSpan.addEvent('checkpoint.reached');
   * }
   * ```
   */
  getCurrentSpan(): ISpan | undefined;

  /**
   * Get the current trace context from RequestContext.
   *
   * @returns Current trace context or undefined if none active
   *
   * @example
   * ```typescript
   * const ctx = tracer.getCurrentContext();
   * if (ctx) {
   *   console.log('Current trace:', ctx.traceId);
   * }
   * ```
   */
  getCurrentContext(): TraceContext | undefined;

  /**
   * Link the tracer to a RequestContext.
   *
   * After linking, new spans will use the context's traceId
   * and propagate trace information.
   *
   * @param context - RequestContext to link
   *
   * @example
   * ```typescript
   * RequestContext.run({ traceId: 'incoming-trace-id' }, async () => {
   *   const ctx = RequestContext.current();
   *   tracer.linkToContext(ctx);
   *
   *   // Spans now use the context's trace ID
   *   const span = tracer.startSpan('operation');
   * });
   * ```
   */
  linkToContext(context: IContext<TContext>): void;

  /**
   * Inject trace context into a carrier object (e.g., HTTP headers).
   *
   * @template TCarrier - Type of the carrier object
   * @param carrier - Object to inject context into
   * @param context - Optional specific context (defaults to current)
   * @returns The carrier with injected context
   *
   * @example
   * ```typescript
   * // Inject into HTTP headers
   * const headers = tracer.inject({
   *   'Content-Type': 'application/json',
   * });
   * // headers now includes: traceparent, tracestate
   *
   * await fetch('https://downstream.service/api', {
   *   headers,
   *   body: JSON.stringify(data),
   * });
   * ```
   */
  inject<TCarrier extends Record<string, string>>(
    carrier: TCarrier,
    context?: TraceContext,
  ): TCarrier;

  /**
   * Extract trace context from a carrier object (e.g., HTTP headers).
   *
   * @template TCarrier - Type of the carrier object
   * @param carrier - Object containing trace context
   * @returns Extracted trace context or undefined
   *
   * @example
   * ```typescript
   * // Extract from incoming request
   * const parentContext = tracer.extract(request.headers);
   *
   * // Start a span with the extracted parent
   * const span = tracer.startSpan('handleRequest', {
   *   parent: parentContext,
   *   kind: SpanKind.Server,
   * });
   * ```
   */
  extract<TCarrier extends Record<string, string | string[] | undefined>>(
    carrier: TCarrier,
  ): TraceContext | undefined;

  /**
   * Check if tracing is enabled and operational.
   *
   * @returns True if tracing is enabled
   */
  isEnabled(): boolean;

  /**
   * Flush any pending spans to the backend.
   *
   * Useful before shutting down the service to ensure
   * all spans are exported.
   *
   * @returns Promise that resolves when flush is complete
   *
   * @example
   * ```typescript
   * // In shutdown handler
   * process.on('SIGTERM', async () => {
   *   await tracer.flush();
   *   process.exit(0);
   * });
   * ```
   */
  flush(): Promise<void>;
}

/**
 * ITracerFactory - Factory for creating tracer instances.
 *
 * @template TContext - Context data type extending StruktosContextData
 *
 * @example
 * ```typescript
 * // Create tracer with custom configuration
 * const factory = container.resolve<ITracerFactory>(TRACER_FACTORY_TOKEN);
 *
 * const tracer = factory.create({
 *   serviceName: 'order-service',
 *   serviceVersion: '1.0.0',
 *   sampler: { type: 'ratio', ratio: 0.1 },
 * });
 * ```
 */
export interface ITracerFactory<
  TContext extends StruktosContextData = StruktosContextData,
> {
  /**
   * Create a new tracer instance.
   *
   * @param options - Tracer configuration options
   * @returns New tracer instance
   */
  create(options: TracerOptions): ITracer<TContext>;
}

/**
 * Tracer configuration options.
 *
 * @example
 * ```typescript
 * const options: TracerOptions = {
 *   serviceName: 'payment-service',
 *   serviceVersion: '2.1.0',
 *   environment: 'production',
 *   sampler: {
 *     type: 'parentBased',
 *     root: { type: 'ratio', ratio: 0.1 },
 *   },
 *   exporters: ['jaeger', 'console'],
 * };
 * ```
 */
export interface TracerOptions {
  /**
   * Name of the service being traced.
   */
  serviceName: string;

  /**
   * Version of the service.
   */
  serviceVersion?: string;

  /**
   * Deployment environment (e.g., 'production', 'staging').
   */
  environment?: string;

  /**
   * Sampling configuration.
   */
  sampler?: SamplerConfig;

  /**
   * List of exporters to use.
   */
  exporters?: string[];

  /**
   * Maximum number of attributes per span.
   */
  maxAttributesPerSpan?: number;

  /**
   * Maximum number of events per span.
   */
  maxEventsPerSpan?: number;

  /**
   * Maximum number of links per span.
   */
  maxLinksPerSpan?: number;

  /**
   * Additional resource attributes.
   */
  resourceAttributes?: SpanAttributes;
}

/**
 * Sampler configuration for trace sampling decisions.
 */
export interface SamplerConfig {
  /**
   * Sampler type.
   */
  type: 'always' | 'never' | 'ratio' | 'parentBased';

  /**
   * Sampling ratio for 'ratio' type (0.0 to 1.0).
   */
  ratio?: number;

  /**
   * Root sampler config for 'parentBased' type.
   */
  root?: SamplerConfig;
}

/**
 * Dependency injection token for ITracer.
 *
 * @example
 * ```typescript
 * container.register(TRACER_TOKEN, {
 *   useClass: OpenTelemetryTracer,
 * });
 * ```
 */
export const TRACER_TOKEN = Symbol('ITracer');

/**
 * Dependency injection token for ITracerFactory.
 */
export const TRACER_FACTORY_TOKEN = Symbol('ITracerFactory');
