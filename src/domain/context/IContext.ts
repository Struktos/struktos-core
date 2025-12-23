/**
 * @fileoverview Context Interface - Domain Layer Core Abstraction
 *
 * @packageDocumentation
 * @module @struktos/core/domain/context
 *
 * ## Hexagonal Architecture Layer: DOMAIN (Core)
 *
 * This file belongs to the **Domain Layer**, which is the innermost layer
 * of Hexagonal Architecture. The Domain layer:
 *
 * - ✅ **CAN**: Define abstractions and interfaces
 * - ✅ **CAN**: Contain pure business logic
 * - ✅ **CAN**: Define value objects and entities
 * - ❌ **CANNOT**: Depend on infrastructure (databases, HTTP, external APIs)
 * - ❌ **CANNOT**: Import from Application or Infrastructure layers
 * - ❌ **CANNOT**: Know about how data is stored or transported
 *
 * ## Architectural Responsibility
 *
 * This module defines the **IContext interface**, inspired by Go's context package.
 * Context provides a unified way to:
 *
 * 1. **Propagate request-scoped values** across async boundaries
 * 2. **Signal cancellation** to stop long-running operations
 * 3. **Carry metadata** like trace IDs, user IDs, timestamps
 *
 * ## Why Context Matters in Enterprise Systems
 *
 * In distributed systems and microservices, we need to track:
 * - **Who** initiated the request (authentication)
 * - **What** trace/correlation ID to use (distributed tracing)
 * - **When** to stop processing (cancellation, timeouts)
 * - **Where** in the call stack we are (debugging)
 *
 * Without a context system, you'd have to manually pass these values
 * through every function call, polluting your business logic:
 *
 * ```typescript
 * // ❌ BAD: Manual parameter passing
 * async function processOrder(orderId: string, userId: string, traceId: string) {
 *   await validateOrder(orderId, userId, traceId);
 *   await chargePayment(orderId, userId, traceId);
 *   await shipOrder(orderId, userId, traceId);
 * }
 *
 * // ✅ GOOD: Context propagation
 * async function processOrder(orderId: string) {
 *   const ctx = RequestContext.current();
 *   // userId and traceId automatically available
 *   await validateOrder(orderId);
 *   await chargePayment(orderId);
 *   await shipOrder(orderId);
 * }
 * ```
 *
 * @see {@link https://go.dev/blog/context | Go Context Package}
 * @see {@link RequestContext} for the AsyncLocalStorage-based implementation
 * @version 1.0.0
 */

/**
 * IContext - Core context interface for request lifecycle management.
 *
 * @template T - Type of context data (defaults to any for maximum flexibility)
 *
 * @remarks
 * **Design Philosophy:**
 *
 * This interface is intentionally minimal and focused. It provides only
 * the essential operations needed for context management:
 *
 * 1. **Storage**: get/set/has/delete for key-value data
 * 2. **Cancellation**: isCancelled/onCancel/cancel for cooperative cancellation
 * 3. **Snapshot**: getAll for debugging and logging
 *
 * The interface does NOT include:
 * - Serialization (context is in-memory only)
 * - Hierarchical parent/child (kept simple)
 * - Deadline/timeout (use cancellation callbacks instead)
 *
 * **Thread Safety:**
 *
 * In Node.js, this context is "async-safe" thanks to AsyncLocalStorage.
 * Each async operation gets its own isolated context, preventing
 * data races that would occur with global variables.
 *
 * **Memory Management:**
 *
 * Context data is automatically garbage collected when the async operation
 * completes. No manual cleanup needed. The RequestContext.run() scope
 * defines the lifetime.
 *
 * @example Basic usage
 * ```typescript
 * // Create context with initial data
 * RequestContext.run({ traceId: 'abc-123' }, async () => {
 *   const ctx = RequestContext.current();
 *
 *   // Read values
 *   console.log(ctx?.get('traceId')); // 'abc-123'
 *
 *   // Add values
 *   ctx?.set('userId', 'user-456');
 *
 *   // Check existence
 *   if (ctx?.has('userId')) {
 *     // ... use userId
 *   }
 * });
 * ```
 *
 * @example Cancellation for cleanup
 * ```typescript
 * RequestContext.run({}, async () => {
 *   const ctx = RequestContext.current();
 *
 *   // Open database connection
 *   const connection = await db.connect();
 *
 *   // Register cleanup handler
 *   ctx?.onCancel(() => {
 *     connection.close();
 *     console.log('Database connection closed');
 *   });
 *
 *   // Later, if request is cancelled:
 *   ctx?.cancel(); // Triggers cleanup handlers
 * });
 * ```
 *
 * @example Type-safe context data
 * ```typescript
 * interface MyContextData {
 *   traceId: string;
 *   userId?: string;
 *   sessionId?: string;
 * }
 *
 * RequestContext.run<MyContextData>(
 *   { traceId: 'xyz-789' },
 *   async () => {
 *     const ctx = RequestContext.current<MyContextData>();
 *
 *     // TypeScript knows traceId is string
 *     const trace: string | undefined = ctx?.get('traceId');
 *
 *     // TypeScript knows userId is optional
 *     const user: string | undefined = ctx?.get('userId');
 *   }
 * );
 * ```
 */
export interface IContext<T = any> {
  /**
   * Get a value from the context by key.
   *
   * @template K - Key type (inferred from T)
   * @param key - The key to look up
   * @returns The value associated with the key, or undefined if not found
   *
   * @remarks
   * This method performs an O(1) lookup using a Map internally.
   * It's safe to call repeatedly without performance concerns.
   *
   * Returns `undefined` if:
   * - The key doesn't exist
   * - The value was explicitly set to undefined
   *
   * Use {@link has} to distinguish between "key doesn't exist" and
   * "key exists but value is undefined".
   *
   * @example Retrieving trace ID
   * ```typescript
   * const ctx = RequestContext.current();
   * const traceId = ctx?.get('traceId');
   *
   * if (traceId) {
   *   logger.info('Processing request', { traceId });
   * }
   * ```
   *
   * @example Type-safe retrieval
   * ```typescript
   * interface AppContext {
   *   requestId: string;
   *   userId?: number;
   * }
   *
   * const ctx = RequestContext.current<AppContext>();
   * const requestId: string | undefined = ctx?.get('requestId');
   * const userId: number | undefined = ctx?.get('userId');
   * ```
   */
  get<K extends keyof T>(key: K): T[K] | undefined;

  /**
   * Set a value in the context.
   *
   * @template K - Key type (inferred from T)
   * @param key - The key to set
   * @param value - The value to associate with the key
   *
   * @remarks
   * **Mutability:**
   *
   * Context is intentionally mutable to allow enriching it as the request
   * flows through the system:
   *
   * 1. HTTP Middleware adds: requestId, ip, userAgent
   * 2. Auth Middleware adds: userId, roles, claims
   * 3. Business Logic adds: customerId, orderId, etc.
   *
   * This is safe because each async operation has its own context instance
   * thanks to AsyncLocalStorage.
   *
   * **Performance:**
   *
   * Setting a value is O(1) with a Map. You can set values freely without
   * worrying about performance.
   *
   * **Best Practices:**
   *
   * - Use clear, descriptive keys (avoid generic names like 'data', 'info')
   * - Prefer primitive values (strings, numbers) over complex objects
   * - Don't store large objects (context is meant for metadata)
   * - Don't store functions (context is data, not behavior)
   *
   * @example Enriching context through middleware layers
   * ```typescript
   * // 1. HTTP layer sets basic request info
   * ctx.set('requestId', generateId());
   * ctx.set('ip', req.ip);
   *
   * // 2. Auth layer adds user info
   * ctx.set('userId', user.id);
   * ctx.set('roles', user.roles);
   *
   * // 3. Business logic adds domain entities
   * ctx.set('customerId', order.customerId);
   * ctx.set('orderId', order.id);
   * ```
   */
  set<K extends keyof T>(key: K, value: T[K]): void;

  /**
   * Check if the context has been cancelled.
   *
   * @returns True if cancel() has been called, false otherwise
   *
   * @remarks
   * **Cooperative Cancellation:**
   *
   * Node.js doesn't have preemptive thread cancellation like some languages.
   * Instead, we use "cooperative cancellation" where:
   *
   * 1. A parent operation calls `ctx.cancel()`
   * 2. Child operations periodically check `ctx.isCancelled()`
   * 3. If cancelled, they voluntarily stop and clean up
   *
   * **When to Check:**
   *
   * Check `isCancelled()` at natural checkpoints in your code:
   *
   * - Start of loops
   * - Between major processing steps
   * - Before expensive operations (DB queries, API calls)
   * - After awaiting async operations
   *
   * **What to Do When Cancelled:**
   *
   * When you detect cancellation:
   * 1. Stop further processing immediately
   * 2. Clean up resources (close connections, delete temp files)
   * 3. Throw an error or return an error response
   *
   * @example Checking cancellation in a batch process
   * ```typescript
   * async function processBatch(items: Item[]) {
   *   const ctx = RequestContext.current();
   *
   *   for (const item of items) {
   *     // Check cancellation at start of loop
   *     if (ctx?.isCancelled()) {
   *       throw new OperationCancelledError('Batch processing cancelled');
   *     }
   *
   *     await processItem(item);
   *   }
   * }
   * ```
   *
   * @example Checking cancellation in recursive algorithm
   * ```typescript
   * async function recursiveSearch(node: TreeNode, depth: number): Promise<Result | null> {
   *   const ctx = RequestContext.current();
   *
   *   // Check before expensive operation
   *   if (ctx?.isCancelled()) {
   *     return null;
   *   }
   *
   *   if (depth > 100) return null;
   *
   *   for (const child of node.children) {
   *     const result = await recursiveSearch(child, depth + 1);
   *     if (result) return result;
   *   }
   *
   *   return null;
   * }
   * ```
   */
  isCancelled(): boolean;

  /**
   * Register a callback to be invoked when the context is cancelled.
   *
   * @param callback - Function to call when context is cancelled
   *
   * @remarks
   * **Cleanup Pattern:**
   *
   * Use `onCancel()` to register cleanup handlers for resources that need
   * explicit cleanup (connections, file handles, timers, etc.).
   *
   * **Execution Guarantee:**
   *
   * - If context is NOT cancelled: callback is never called
   * - If context IS cancelled: callback is called exactly once
   * - If context is already cancelled when you register: callback is called immediately
   *
   * **Error Handling:**
   *
   * Errors thrown in cancel callbacks are caught and logged, but don't
   * prevent other callbacks from running. Always use try-catch inside
   * your callbacks for critical cleanup.
   *
   * **Order of Execution:**
   *
   * Callbacks are executed in the order they were registered. No guarantees
   * about async execution order if callbacks themselves are async.
   *
   * **Best Practices:**
   *
   * - Register cleanup handlers as soon as you acquire the resource
   * - Keep callbacks simple and fast (cleanup only, no business logic)
   * - Don't register callbacks in loops (memory leak risk)
   * - Always handle errors in your callbacks
   *
   * @example Resource cleanup on cancellation
   * ```typescript
   * async function queryDatabase(sql: string) {
   *   const ctx = RequestContext.current();
   *   const connection = await pool.connect();
   *
   *   // Register cleanup immediately after acquiring resource
   *   ctx?.onCancel(() => {
   *     try {
   *       connection.release();
   *       console.log('Database connection released due to cancellation');
   *     } catch (error) {
   *       console.error('Error releasing connection:', error);
   *     }
   *   });
   *
   *   return connection.query(sql);
   * }
   * ```
   *
   * @example HTTP request cancellation
   * ```typescript
   * async function fetchExternalAPI(url: string) {
   *   const ctx = RequestContext.current();
   *   const abortController = new AbortController();
   *
   *   // Cancel fetch if context is cancelled
   *   ctx?.onCancel(() => {
   *     abortController.abort();
   *     console.log('External API call cancelled');
   *   });
   *
   *   return fetch(url, { signal: abortController.signal });
   * }
   * ```
   *
   * @example Multiple cleanup handlers
   * ```typescript
   * async function complexOperation() {
   *   const ctx = RequestContext.current();
   *
   *   const tempFile = await createTempFile();
   *   ctx?.onCancel(() => {
   *     fs.unlinkSync(tempFile);
   *     console.log('Temp file deleted');
   *   });
   *
   *   const socket = await openSocket();
   *   ctx?.onCancel(() => {
   *     socket.close();
   *     console.log('Socket closed');
   *   });
   *
   *   const timer = setInterval(() => heartbeat(), 5000);
   *   ctx?.onCancel(() => {
   *     clearInterval(timer);
   *     console.log('Heartbeat timer cleared');
   *   });
   *
   *   // ... do work
   * }
   * ```
   */
  onCancel(callback: () => void): void;

  /**
   * Cancel the context and invoke all registered callbacks.
   *
   * @remarks
   * **Idempotency:**
   *
   * Calling `cancel()` multiple times is safe - callbacks are only
   * invoked once, on the first call. Subsequent calls are no-ops.
   *
   * **Propagation:**
   *
   * Context cancellation does NOT automatically propagate to child
   * async operations. If you need hierarchical cancellation, you must:
   *
   * 1. Check `isCancelled()` periodically
   * 2. Call `cancel()` on child contexts explicitly
   * 3. Use cancellation callbacks to propagate signals
   *
   * **Side Effects:**
   *
   * When you call `cancel()`:
   * 1. Sets internal `cancelled` flag to true
   * 2. Executes all registered `onCancel()` callbacks in order
   * 3. Clears the callback registry to prevent memory leaks
   *
   * **When to Cancel:**
   *
   * Common cancellation scenarios:
   * - Client disconnects from HTTP connection
   * - Operation timeout exceeded
   * - User explicitly cancels the operation
   * - Circuit breaker opens
   * - Graceful shutdown initiated
   *
   * @example HTTP connection closed
   * ```typescript
   * app.get('/long-running-task', (req, res) => {
   *   RequestContext.run({ requestId: generateId() }, async () => {
   *     const ctx = RequestContext.current();
   *
   *     // Cancel context if client disconnects
   *     res.on('close', () => {
   *       if (!res.writableEnded) {
   *         ctx?.cancel();
   *         console.log('Client disconnected, cancelling task');
   *       }
   *     });
   *
   *     await performLongTask();
   *     res.json({ success: true });
   *   });
   * });
   * ```
   *
   * @example Timeout-based cancellation
   * ```typescript
   * async function withTimeout<T>(
   *   operation: () => Promise<T>,
   *   timeoutMs: number
   * ): Promise<T> {
   *   const ctx = RequestContext.current();
   *
   *   const timeoutHandle = setTimeout(() => {
   *     ctx?.cancel();
   *     console.log(`Operation timed out after ${timeoutMs}ms`);
   *   }, timeoutMs);
   *
   *   try {
   *     return await operation();
   *   } finally {
   *     clearTimeout(timeoutHandle);
   *   }
   * }
   * ```
   *
   * @example Graceful shutdown
   * ```typescript
   * process.on('SIGTERM', () => {
   *   console.log('SIGTERM received, cancelling all active requests');
   *
   *   // In a real implementation, you'd track active contexts
   *   activeContexts.forEach(ctx => ctx.cancel());
   * });
   * ```
   */
  cancel(): void;

  /**
   * Get all context data as a readonly snapshot.
   *
   * @returns Readonly object containing all context key-value pairs
   *
   * @remarks
   * **Use Cases:**
   *
   * This method is primarily for:
   * - **Debugging**: Inspect what's in the context
   * - **Logging**: Include all context data in error logs
   * - **Testing**: Verify context contents in tests
   * - **Serialization**: Convert context to JSON for logging
   *
   * **Important Notes:**
   *
   * - Returns a **shallow copy** - mutations won't affect the context
   * - The return type is `Readonly<Partial<T>>` - values may be undefined
   * - Performance: O(n) where n is the number of keys
   *
   * **Security Warning:**
   *
   * Be careful when logging or serializing context - it may contain
   * sensitive data (user IDs, session tokens, etc.). Always sanitize
   * before sending to external systems.
   *
   * @example Logging context for debugging
   * ```typescript
   * try {
   *   await processOrder(orderId);
   * } catch (error) {
   *   const ctx = RequestContext.current();
   *   const contextData = ctx?.getAll();
   *
   *   logger.error('Order processing failed', {
   *     error: error.message,
   *     context: contextData, // Includes traceId, userId, etc.
   *   });
   *
   *   throw error;
   * }
   * ```
   *
   * @example Testing context contents
   * ```typescript
   * it('should set user info in context', async () => {
   *   RequestContext.run({}, async () => {
   *     const ctx = RequestContext.current();
   *     ctx?.set('userId', 'user-123');
   *     ctx?.set('roles', ['admin']);
   *
   *     const all = ctx?.getAll();
   *     expect(all).toEqual({
   *       userId: 'user-123',
   *       roles: ['admin'],
   *     });
   *   });
   * });
   * ```
   *
   * @example Sanitizing sensitive data before logging
   * ```typescript
   * function sanitizeContext(ctx: IContext): Record<string, any> {
   *   const all = ctx.getAll();
   *   const sanitized = { ...all };
   *
   *   // Remove sensitive fields
   *   delete sanitized.password;
   *   delete sanitized.apiKey;
   *   delete sanitized.sessionToken;
   *
   *   // Mask user ID
   *   if (sanitized.userId) {
   *     sanitized.userId = `***${sanitized.userId.slice(-4)}`;
   *   }
   *
   *   return sanitized;
   * }
   * ```
   */
  getAll(): Readonly<Partial<T>>;

  /**
   * Check if a key exists in the context.
   *
   * @template K - Key type (inferred from T)
   * @param key - The key to check
   * @returns True if the key exists (even if value is undefined), false otherwise
   *
   * @remarks
   * **Difference from get():**
   *
   * This method allows you to distinguish between:
   * - "Key doesn't exist" → `has()` returns `false`
   * - "Key exists but value is undefined" → `has()` returns `true`, `get()` returns `undefined`
   *
   * This is similar to the difference between `Map.has()` and `Map.get()`.
   *
   * **Use Cases:**
   *
   * - Check if a value was explicitly set (even to undefined)
   * - Conditional logic based on presence of keys
   * - Validation before accessing values
   *
   * @example Checking for optional values
   * ```typescript
   * const ctx = RequestContext.current();
   *
   * if (ctx?.has('userId')) {
   *   // User is authenticated (userId was set, even if undefined)
   *   const userId = ctx.get('userId');
   *   console.log('Authenticated user:', userId);
   * } else {
   *   // User is not authenticated (userId was never set)
   *   console.log('Anonymous user');
   * }
   * ```
   */
  has<K extends keyof T>(key: K): boolean;

  /**
   * Delete a key from the context.
   *
   * @template K - Key type (inferred from T)
   * @param key - The key to delete
   * @returns True if the key existed and was deleted, false otherwise
   *
   * @remarks
   * **When to Delete:**
   *
   * Deleting keys is rare in practice. Most common uses:
   * - Removing sensitive data after it's no longer needed
   * - Clearing temporary values between operations
   * - Testing/debugging
   *
   * **Alternative to Deletion:**
   *
   * Often it's better to set a value to `undefined` or `null` rather
   * than deleting, as it preserves the key's presence (detectable via `has()`).
   *
   * @example Removing sensitive data
   * ```typescript
   * async function authenticateUser(password: string) {
   *   const ctx = RequestContext.current();
   *
   *   // Temporarily store password for validation
   *   ctx?.set('tempPassword', password);
   *
   *   const isValid = await bcrypt.compare(password, user.passwordHash);
   *
   *   // Immediately delete password from context
   *   ctx?.delete('tempPassword');
   *
   *   return isValid;
   * }
   * ```
   */
  delete<K extends keyof T>(key: K): boolean;
}

/**
 * Standard context keys used across Struktos.js framework.
 *
 * @remarks
 * **Convention over Configuration:**
 *
 * Struktos.js uses these standard keys to enable framework features:
 * - **traceId**: Distributed tracing and log correlation
 * - **requestId**: Unique identifier for this request
 * - **userId**: Authentication and authorization
 * - **timestamp**: Request timing and performance monitoring
 * - **url/method**: HTTP request metadata
 *
 * **Extensibility:**
 *
 * This interface uses index signature (`[key: string]: any`) to allow
 * adding custom properties without type errors. Your application can
 * extend this with domain-specific fields:
 *
 * ```typescript
 * interface MyContextData extends StruktosContextData {
 *   organizationId: string;
 *   featureFlags: string[];
 *   locale: string;
 * }
 * ```
 *
 * **Middleware Contracts:**
 *
 * Different middleware layers contribute different fields:
 * - HTTP adapter: requestId, method, url, ip, userAgent, timestamp
 * - Auth middleware: userId, user, roles, claims
 * - Tracing middleware: traceId, spanId
 * - Your custom middleware: domain-specific fields
 *
 * @example Type-safe custom context
 * ```typescript
 * interface MyAppContext extends StruktosContextData {
 *   tenantId: string;
 *   subscription: 'free' | 'pro' | 'enterprise';
 *   requestCount: number;
 * }
 *
 * RequestContext.run<MyAppContext>({
 *   traceId: 'trace-123',
 *   tenantId: 'tenant-456',
 *   subscription: 'enterprise',
 *   requestCount: 1,
 * }, async () => {
 *   const ctx = RequestContext.current<MyAppContext>();
 *   console.log('Tenant:', ctx?.get('tenantId'));
 *   console.log('Plan:', ctx?.get('subscription'));
 * });
 * ```
 */
export interface StruktosContextData {
  /**
   * Unique trace ID for distributed tracing.
   *
   * @remarks
   * Used to correlate logs and spans across multiple services.
   * Should be generated once at the edge and propagated downstream.
   *
   * Format: Usually a UUID or similar unique identifier.
   *
   * @example
   * ```typescript
   * traceId: '550e8400-e29b-41d4-a716-446655440000'
   * ```
   */
  traceId?: string;

  /**
   * Request ID unique to this specific request.
   *
   * @remarks
   * Different from traceId - a single trace may span multiple requests.
   * Generated fresh for each incoming request.
   *
   * @example
   * ```typescript
   * requestId: 'req-' + Date.now() + '-' + Math.random().toString(36)
   * ```
   */
  requestId?: string;

  /**
   * Authenticated user ID.
   *
   * @remarks
   * Set by authentication middleware after verifying credentials.
   * Present only for authenticated requests.
   *
   * @example
   * ```typescript
   * userId: 'user-12345' // After successful authentication
   * userId: undefined     // For anonymous/public endpoints
   * ```
   */
  userId?: string;

  /**
   * Request start timestamp (Unix milliseconds).
   *
   * @remarks
   * Set when the request enters the system. Used for:
   * - Request duration calculation
   * - Timeout enforcement
   * - Performance monitoring
   *
   * @example
   * ```typescript
   * timestamp: Date.now() // 1701234567890
   *
   * // Later, calculate duration:
   * const duration = Date.now() - ctx.get('timestamp');
   * ```
   */
  timestamp?: number;

  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.).
   *
   * @remarks
   * Set by HTTP adapter. Useful for logging and routing logic.
   *
   * @example
   * ```typescript
   * method: 'POST'
   * method: 'GET'
   * ```
   */
  method?: string;

  /**
   * Request URL or path.
   *
   * @remarks
   * Set by HTTP adapter. May include query parameters or just the path.
   *
   * @example
   * ```typescript
   * url: '/api/users/123'
   * url: '/api/orders?status=pending&limit=10'
   * ```
   */
  url?: string;

  /**
   * Client IP address.
   *
   * @remarks
   * Extracted from request headers (X-Forwarded-For) or socket.
   * Useful for rate limiting, geolocation, security.
   *
   * @example
   * ```typescript
   * ip: '192.168.1.100'
   * ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' // IPv6
   * ```
   */
  ip?: string;

  /**
   * User agent string from HTTP headers.
   *
   * @remarks
   * Identifies the client software (browser, mobile app, etc.).
   * Useful for analytics, compatibility checks, bot detection.
   *
   * @example
   * ```typescript
   * userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
   * ```
   */
  userAgent?: string;

  /**
   * Authenticated user object.
   *
   * @remarks
   * Full user data after authentication. Structure depends on your
   * authentication system.
   *
   * **Security Warning**: Don't include sensitive data like password hashes.
   *
   * @example
   * ```typescript
   * user: {
   *   id: 'user-123',
   *   email: 'john@example.com',
   *   name: 'John Doe',
   *   roles: ['user', 'admin']
   * }
   * ```
   */
  user?: Record<string, any>;

  /**
   * User roles for role-based access control (RBAC).
   *
   * @remarks
   * Array of role names the user possesses.
   * Used for authorization checks.
   *
   * @example
   * ```typescript
   * roles: ['user', 'admin']
   * roles: ['guest']
   * roles: [] // No roles (unauthenticated or no permissions)
   * ```
   */
  roles?: string[];

  /**
   * Claims for claims-based authorization.
   *
   * @remarks
   * More granular than roles. Each claim is a type-value pair.
   * Inspired by OAuth2/JWT claims.
   *
   * @example
   * ```typescript
   * claims: [
   *   { type: 'email', value: 'john@example.com' },
   *   { type: 'department', value: 'engineering' },
   *   { type: 'clearance_level', value: '3' }
   * ]
   * ```
   */
  claims?: Array<{ type: string; value: string }>;

  /**
   * Index signature to allow custom properties.
   *
   * @remarks
   * Your application can add domain-specific fields without modifying
   * this interface. Use interface extension for type safety:
   *
   * ```typescript
   * interface MyContext extends StruktosContextData {
   *   customField: string;
   * }
   * ```
   */
  [key: string]: any;
}

/**
 * Type alias for the standard Struktos context.
 *
 * @remarks
 * This is a convenience type that combines IContext with StruktosContextData.
 * Use this when you want the standard context structure without custom fields.
 *
 * @example
 * ```typescript
 * function middleware(ctx: StruktosContext) {
 *   const traceId = ctx.get('traceId');
 *   const userId = ctx.get('userId');
 *   // ...
 * }
 * ```
 */
export type StruktosContext = IContext<StruktosContextData>;
