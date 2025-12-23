/**
 * @fileoverview RequestContext - AsyncLocalStorage-based Context Implementation
 *
 * @packageDocumentation
 * @module @struktos/core/domain/context
 *
 * ## Hexagonal Architecture Layer: DOMAIN (Core Implementation)
 *
 * This file belongs to the **Domain Layer** and provides the concrete
 * implementation of the IContext interface using Node.js AsyncLocalStorage.
 *
 * ## The Magic of AsyncLocalStorage 🎩✨
 *
 * **The Problem This Solves:**
 *
 * In traditional Node.js, there's no way to "attach" data to an async operation.
 * If you want to pass a trace ID through your application, you have two options:
 *
 * 1. ❌ **Global variables** - Race conditions! Data from different requests mix
 * 2. ❌ **Manual parameters** - Pollutes every function signature
 *
 * ```typescript
 * // ❌ BAD: Global variable (breaks with concurrent requests)
 * let currentTraceId: string;
 *
 * app.get('/api/users', async (req, res) => {
 *   currentTraceId = req.headers['x-trace-id'];  // User A's request
 *   await processUsers();  // <-- User B's request starts here!
 *   res.json({ traceId: currentTraceId });  // Returns User B's trace ID! 💥
 * });
 *
 * // ❌ BAD: Manual parameters (code pollution)
 * async function processUsers(traceId: string) {
 *   await validateUsers(traceId);
 *   await fetchUsers(traceId);
 *   await enrichUsers(traceId);
 * }
 * ```
 *
 * **The Solution: AsyncLocalStorage**
 *
 * AsyncLocalStorage provides "async-safe storage" that:
 * - ✅ Automatically isolates data per async operation
 * - ✅ Propagates through all async boundaries (promises, callbacks, timers)
 * - ✅ No manual parameter passing needed
 * - ✅ Zero risk of data races between concurrent operations
 *
 * Think of it as "thread-local storage" but for Node.js async operations.
 *
 * ## How AsyncLocalStorage Works Internally
 *
 * **Step-by-Step Visualization:**
 *
 * ```typescript
 * // 1. Create an AsyncLocalStorage instance (one per application)
 * const als = new AsyncLocalStorage<Store>();
 *
 * // 2. Start a new "context scope" with als.run()
 * als.run(storeObject, async () => {
 *   // Inside this scope, storeObject is "attached" to this async operation
 *
 *   // 3. Retrieve the store from anywhere in the call stack
 *   const store = als.getStore(); // Returns storeObject
 *
 *   // 4. Works through Promise chains
 *   await someAsyncOperation();  // store is still accessible!
 *
 *   // 5. Works in callbacks
 *   setTimeout(() => {
 *     const store = als.getStore();  // Still accessible!
 *   }, 100);
 *
 *   // 6. Works in nested async functions
 *   await deeplyNested();  // store propagates automatically
 * });
 *
 * // 7. Outside the scope, store is undefined
 * const store = als.getStore(); // undefined
 * ```
 *
 * **The Magic Explained:**
 *
 * Node.js internally uses "execution contexts" (think of them as invisible IDs).
 * When you call `als.run(store, callback)`:
 *
 * 1. Node assigns an internal execution context ID to this operation
 * 2. It stores a mapping: `executionContextId → store`
 * 3. When you call `als.getStore()`, Node looks up the current execution context ID
 * 4. Returns the associated store
 *
 * ```
 * Execution Context 1 (Request A)  →  { traceId: 'trace-A' }
 * Execution Context 2 (Request B)  →  { traceId: 'trace-B' }
 * Execution Context 3 (Request C)  →  { traceId: 'trace-C' }
 * ```
 *
 * Even though these operations are running concurrently, Node.js keeps them
 * isolated. Each async operation "remembers" its own store.
 *
 * ## Performance Considerations
 *
 * AsyncLocalStorage is **highly optimized** in modern Node.js:
 * - Overhead: ~50-100 nanoseconds per `getStore()` call
 * - Memory: Minimal (just a Map of execution context → store)
 * - No impact on garbage collection (automatically cleaned up)
 *
 * However, be aware:
 * - Don't call `getStore()` in tight loops (cache the result)
 * - Don't store large objects in context (context is for metadata)
 * - Don't create millions of context scopes per second (though 100k+ is fine)
 *
 * @see {@link https://nodejs.org/api/async_context.html | Node.js AsyncLocalStorage}
 * @see {@link https://blog.appsignal.com/2023/05/03/using-asynclocalstorage-for-request-context-in-nodejs.html | AsyncLocalStorage Guide}
 * @version 1.0.0
 */

import { AsyncLocalStorage } from 'async_hooks';
import { IContext, StruktosContextData } from './IContext';

/**
 * Internal store structure for context data.
 *
 * @remarks
 * **Design Rationale:**
 *
 * We use a separate internal store structure rather than storing
 * the context data directly because we need to track:
 *
 * 1. **data**: The actual key-value pairs
 * 2. **cancelCallbacks**: Functions to call on cancellation
 * 3. **cancelled**: Boolean flag for cancellation state
 *
 * This is similar to how Go's context works internally.
 *
 * **Why Map instead of Object:**
 *
 * We use `Map<string, any>` for data storage because:
 * - ✅ Faster for frequent insertions/deletions
 * - ✅ Preserves insertion order (useful for debugging)
 * - ✅ Can use any value as key (though we use strings)
 * - ✅ Built-in `has()` method that's more reliable than `in` operator
 *
 * **Why Set for callbacks:**
 *
 * We use `Set<() => void>` for callbacks because:
 * - ✅ Automatically deduplicates callbacks
 * - ✅ Efficient iteration
 * - ✅ Easy to clear all callbacks after cancellation
 *
 * @internal
 */
interface ContextStore {
  /** Key-value store for context data */
  data: Map<string, any>;

  /** Set of callbacks to invoke on cancellation */
  cancelCallbacks: Set<() => void>;

  /** Whether this context has been cancelled */
  cancelled: boolean;
}

/**
 * RequestContext - AsyncLocalStorage-based implementation of IContext.
 *
 * @template T - Context data type, defaults to StruktosContextData
 *
 * @remarks
 * **Architectural Pattern: Singleton + Factory**
 *
 * This class uses a unique pattern:
 * - **Singleton AsyncLocalStorage**: One `als` instance shared by all contexts
 * - **Factory Pattern**: Each call to `run()` or `current()` creates a new wrapper
 *
 * ```typescript
 * // Singleton: One AsyncLocalStorage for the entire application
 * private static als = new AsyncLocalStorage<ContextStore>();
 *
 * // Factory: Each request gets its own RequestContext wrapper
 * RequestContext.run({}, () => {
 *   const ctx1 = RequestContext.current(); // New wrapper
 *   const ctx2 = RequestContext.current(); // Another new wrapper
 *   // Both wrap the SAME underlying store from AsyncLocalStorage
 * });
 * ```
 *
 * **Why This Design:**
 *
 * - The **static als** ensures one global storage mechanism
 * - The **instance wrappers** provide the IContext interface
 * - This separation allows us to:
 *   - Have a clean API (`ctx.get()`, `ctx.set()`)
 *   - Share storage efficiently
 *   - Support multiple concurrent requests
 *
 * **Thread Safety (Async Safety):**
 *
 * Despite being a class with instance methods, RequestContext is "async-safe"
 * because:
 *
 * 1. Each instance just wraps a store reference
 * 2. The store itself is tied to an execution context by AsyncLocalStorage
 * 3. Multiple concurrent operations get different stores
 *
 * ```typescript
 * // Request A
 * RequestContext.run({ id: 'A' }, async () => {
 *   const ctx = RequestContext.current();
 *   console.log(ctx?.get('id')); // Always 'A'
 *   await delay(100);
 *   console.log(ctx?.get('id')); // Still 'A' (even if B runs during delay)
 * });
 *
 * // Request B (runs concurrently)
 * RequestContext.run({ id: 'B' }, async () => {
 *   const ctx = RequestContext.current();
 *   console.log(ctx?.get('id')); // Always 'B'
 * });
 * ```
 *
 * @example Basic usage - HTTP server
 * ```typescript
 * import express from 'express';
 * import { RequestContext } from '@struktos/core';
 *
 * const app = express();
 *
 * // Middleware to create context for each request
 * app.use((req, res, next) => {
 *   RequestContext.run({
 *     traceId: req.headers['x-trace-id'] || generateId(),
 *     requestId: generateId(),
 *     timestamp: Date.now(),
 *     method: req.method,
 *     url: req.url,
 *     ip: req.ip,
 *   }, () => {
 *     next();
 *   });
 * });
 *
 * // Route handler - context automatically available
 * app.get('/api/users', async (req, res) => {
 *   const ctx = RequestContext.current();
 *   const traceId = ctx?.get('traceId');
 *
 *   console.log('Fetching users', { traceId });
 *   const users = await fetchUsers();
 *
 *   res.json({ users, traceId });
 * });
 * ```
 *
 * @example Advanced usage - Nested operations
 * ```typescript
 * // Parent operation
 * RequestContext.run({ operation: 'parent' }, async () => {
 *   const ctx1 = RequestContext.current();
 *   ctx1?.set('depth', 0);
 *
 *   console.log('Parent operation');
 *
 *   // Child operation (inherits parent context)
 *   await childOperation();
 *
 *   console.log('Back to parent');
 * });
 *
 * async function childOperation() {
 *   const ctx = RequestContext.current();
 *   console.log('Operation:', ctx?.get('operation')); // 'parent'
 *   console.log('Depth:', ctx?.get('depth')); // 0
 *
 *   // Modify context (affects parent too - same store)
 *   ctx?.set('depth', 1);
 * }
 * ```
 *
 * @example Cancellation handling
 * ```typescript
 * import { RequestContext } from '@struktos/core';
 *
 * async function longRunningTask() {
 *   const ctx = RequestContext.current();
 *
 *   // Register cleanup handlers
 *   const connection = await db.connect();
 *   ctx?.onCancel(() => {
 *     connection.close();
 *     console.log('Database connection closed');
 *   });
 *
 *   // Simulate long operation
 *   for (let i = 0; i < 1000; i++) {
 *     // Check cancellation periodically
 *     if (ctx?.isCancelled()) {
 *       throw new Error('Operation cancelled');
 *     }
 *
 *     await processItem(i);
 *   }
 * }
 *
 * // HTTP handler with client disconnect detection
 * app.get('/api/long-task', (req, res) => {
 *   RequestContext.run({}, async () => {
 *     const ctx = RequestContext.current();
 *
 *     // Cancel if client disconnects
 *     res.on('close', () => {
 *       if (!res.writableEnded) {
 *         ctx?.cancel();
 *       }
 *     });
 *
 *     try {
 *       const result = await longRunningTask();
 *       res.json({ result });
 *     } catch (error) {
 *       if (ctx?.isCancelled()) {
 *         res.status(499).send('Client Closed Request');
 *       } else {
 *         res.status(500).send('Internal Error');
 *       }
 *     }
 *   });
 * });
 * ```
 */
export class RequestContext<
  T extends StruktosContextData = StruktosContextData,
> implements IContext<T> {
  /**
   * Singleton AsyncLocalStorage instance shared by all RequestContext instances.
   *
   * @remarks
   * **Why Static:**
   *
   * This MUST be static because:
   * 1. AsyncLocalStorage maintains a global registry of execution contexts
   * 2. Multiple AsyncLocalStorage instances would create separate registries
   * 3. Context wouldn't propagate across the separate registries
   *
   * **Lifetime:**
   *
   * Created once when the class is loaded and lives for the entire application.
   * There's no cleanup needed - Node.js handles it automatically.
   *
   * **TypeScript Type:**
   *
   * We store `ContextStore` in AsyncLocalStorage, not `T`, because:
   * - We need internal bookkeeping (cancelled flag, callbacks)
   * - The actual data is stored in `store.data`
   *
   * @private
   * @static
   */
  private static als = new AsyncLocalStorage<ContextStore>();

  /**
   * Reference to the underlying store from AsyncLocalStorage.
   *
   * @remarks
   * **Instance vs Store:**
   *
   * Each `RequestContext` instance is just a thin wrapper around a store:
   *
   * ```typescript
   * // Multiple instances can wrap the same store
   * const ctx1 = RequestContext.current();
   * const ctx2 = RequestContext.current();
   * // ctx1.store === ctx2.store (same underlying data)
   * ```
   *
   * This is safe because the store is isolated per execution context.
   *
   * **Why Not Static:**
   *
   * This is NOT static because each RequestContext wrapper needs to
   * reference its specific store from AsyncLocalStorage.
   *
   * @private
   */
  private store: ContextStore;

  /**
   * Private constructor - use static factory methods instead.
   *
   * @param store - Optional store to wrap (from AsyncLocalStorage)
   *
   * @remarks
   * **Why Private:**
   *
   * Users shouldn't call `new RequestContext()` directly because:
   * 1. They need to use `RequestContext.run()` to create a scope
   * 2. They need to use `RequestContext.current()` to access it
   * 3. Direct construction wouldn't set up AsyncLocalStorage properly
   *
   * **Factory Methods:**
   *
   * Use these instead:
   * - `RequestContext.run(data, callback)` - Create new scope
   * - `RequestContext.current()` - Get current context
   * - `RequestContext.runWithContext(ctx, callback)` - Run with existing context
   *
   * @private
   */
  private constructor(store?: ContextStore) {
    this.store = store || {
      data: new Map(),
      cancelCallbacks: new Set(),
      cancelled: false,
    };
  }

  /**
   * Create a new context scope and run a function within it.
   *
   * @template T - Context data type
   * @template R - Return type of the callback
   * @param initialData - Initial context data (partial)
   * @param callback - Function to run within the context
   * @returns Result of the callback
   *
   * @remarks
   * **Scope Lifetime:**
   *
   * The context scope is active for:
   * 1. The duration of the callback execution
   * 2. All async operations spawned within the callback
   * 3. All nested function calls (sync or async)
   *
   * When the callback completes (including all its async operations),
   * the scope ends and the context is automatically garbage collected.
   *
   * **Async Propagation:**
   *
   * Context automatically propagates through:
   * - ✅ Promise chains: `await foo(); await bar();`
   * - ✅ Callbacks: `setTimeout(() => { ... }, 100);`
   * - ✅ Event handlers: `emitter.on('event', () => { ... });`
   * - ✅ Async iterators: `for await (const item of stream) { ... }`
   * - ✅ Worker threads: (with special setup)
   *
   * **Nesting Behavior:**
   *
   * Unlike some context libraries, `RequestContext.run()` does NOT
   * create a child context. It creates a new independent context:
   *
   * ```typescript
   * RequestContext.run({ id: 'outer' }, async () => {
   *   const ctx1 = RequestContext.current();
   *   console.log(ctx1?.get('id')); // 'outer'
   *
   *   RequestContext.run({ id: 'inner' }, async () => {
   *     const ctx2 = RequestContext.current();
   *     console.log(ctx2?.get('id')); // 'inner' (not 'outer')
   *     console.log(ctx2?.get('traceId')); // undefined (no inheritance)
   *   });
   *
   *   console.log(ctx1?.get('id')); // Still 'outer'
   * });
   * ```
   *
   * If you want to inherit from a parent context, use `clone()`:
   *
   * ```typescript
   * const parent = RequestContext.current();
   * const child = parent?.clone({ additionalField: 'value' });
   * RequestContext.runWithContext(child, async () => {
   *   // Now has both parent data and additionalField
   * });
   * ```
   *
   * **Error Handling:**
   *
   * Exceptions thrown in the callback propagate normally.
   * The context is cleaned up automatically even if an error occurs:
   *
   * ```typescript
   * try {
   *   RequestContext.run({}, async () => {
   *     throw new Error('Oops');
   *   });
   * } catch (error) {
   *   // Context is already cleaned up here
   *   const ctx = RequestContext.current(); // undefined
   * }
   * ```
   *
   * @example HTTP middleware
   * ```typescript
   * app.use((req, res, next) => {
   *   RequestContext.run({
   *     traceId: req.headers['x-trace-id'] || generateId(),
   *     userId: req.user?.id,
   *     timestamp: Date.now(),
   *   }, () => {
   *     next(); // Context available in all route handlers
   *   });
   * });
   * ```
   *
   * @example Async operations
   * ```typescript
   * RequestContext.run({ traceId: 'abc' }, async () => {
   *   // Context available here
   *   await operation1();
   *
   *   // Still available after await
   *   await operation2();
   *
   *   // Even in callbacks
   *   setTimeout(() => {
   *     const ctx = RequestContext.current();
   *     console.log(ctx?.get('traceId')); // 'abc'
   *   }, 1000);
   * });
   * ```
   *
   * @example With return value
   * ```typescript
   * const result = await RequestContext.run({ traceId: 'xyz' }, async () => {
   *   const data = await fetchData();
   *   return processData(data);
   * });
   *
   * console.log('Result:', result);
   * ```
   */
  static run<T extends StruktosContextData = StruktosContextData, R = any>(
    initialData: Partial<T>,
    callback: () => R,
  ): R {
    const store: ContextStore = {
      data: new Map(Object.entries(initialData)),
      cancelCallbacks: new Set(),
      cancelled: false,
    };

    return RequestContext.als.run(store, callback);
  }

  /**
   * Run a function within an existing context.
   *
   * @template T - Context data type
   * @template R - Return type of the callback
   * @param context - Existing RequestContext to use
   * @param callback - Function to run
   * @returns Result of the callback
   *
   * @remarks
   * **Use Case:**
   *
   * This method is useful when you want to:
   * 1. Clone a context with additional data
   * 2. Reuse a context from a different scope
   * 3. Manually manage context propagation
   *
   * **Difference from run():**
   *
   * - `run(data, callback)`: Creates NEW context from scratch
   * - `runWithContext(ctx, callback)`: Reuses EXISTING context
   *
   * **Typical Pattern:**
   *
   * ```typescript
   * // Capture context in parent scope
   * const parentCtx = RequestContext.current();
   *
   * // Later, in a different async operation
   * setTimeout(() => {
   *   // Restore parent context
   *   if (parentCtx) {
   *     RequestContext.runWithContext(parentCtx, () => {
   *       // Context is now available
   *       const ctx = RequestContext.current();
   *       console.log(ctx?.get('traceId'));
   *     });
   *   }
   * }, 5000);
   * ```
   *
   * @example Cloning with additional data
   * ```typescript
   * RequestContext.run({ traceId: 'parent-trace' }, async () => {
   *   const parentCtx = RequestContext.current();
   *
   *   // Create child context with additional data
   *   const childCtx = parentCtx?.clone({ operationId: 'child-op' });
   *
   *   if (childCtx) {
   *     RequestContext.runWithContext(childCtx, async () => {
   *       const ctx = RequestContext.current();
   *       console.log(ctx?.get('traceId')); // 'parent-trace'
   *       console.log(ctx?.get('operationId')); // 'child-op'
   *     });
   *   }
   * });
   * ```
   */
  static runWithContext<
    T extends StruktosContextData = StruktosContextData,
    R = any,
  >(context: RequestContext<T>, callback: () => R): R {
    return RequestContext.als.run(context.store, callback);
  }

  /**
   * Get the current context from AsyncLocalStorage.
   *
   * @template T - Context data type
   * @returns RequestContext instance, or undefined if no context is active
   *
   * @remarks
   * **When to Use:**
   *
   * Call this method when you need to access the current context.
   * It's safe to call from anywhere in your code - if you're within
   * a `RequestContext.run()` scope, you'll get the context.
   *
   * **Returns undefined if:**
   *
   * 1. You're outside a `RequestContext.run()` scope
   * 2. The context scope has ended
   * 3. You're in a different execution context (e.g., different worker thread)
   *
   * **Pattern: Optional Chaining:**
   *
   * Since this can return undefined, use optional chaining:
   *
   * ```typescript
   * const ctx = RequestContext.current();
   * const traceId = ctx?.get('traceId');  // Safe - returns undefined if ctx is undefined
   *
   * // NOT recommended (can throw):
   * const traceId = RequestContext.current().get('traceId');  // ❌ Can throw if no context
   * ```
   *
   * **Performance:**
   *
   * This call is extremely fast (~50-100 nanoseconds). Don't worry
   * about caching the result unless you're in a tight loop.
   *
   * **Multiple Calls:**
   *
   * Each call creates a new wrapper instance, but they all reference
   * the same underlying store:
   *
   * ```typescript
   * const ctx1 = RequestContext.current();
   * const ctx2 = RequestContext.current();
   *
   * ctx1?.set('key', 'value');
   * console.log(ctx2?.get('key')); // 'value' (same store)
   *
   * console.log(ctx1 === ctx2); // false (different wrapper instances)
   * ```
   *
   * @example Basic usage
   * ```typescript
   * async function fetchUser(userId: string) {
   *   const ctx = RequestContext.current();
   *   const traceId = ctx?.get('traceId');
   *
   *   console.log('Fetching user', { userId, traceId });
   *   return db.users.findById(userId);
   * }
   * ```
   *
   * @example Defensive coding
   * ```typescript
   * function logRequest() {
   *   const ctx = RequestContext.current();
   *
   *   if (!ctx) {
   *     // Not in a request context - maybe a background job?
   *     console.log('Operation without context');
   *     return;
   *   }
   *
   *   const traceId = ctx.get('traceId');
   *   const userId = ctx.get('userId');
   *   console.log('Request', { traceId, userId });
   * }
   * ```
   *
   * @example Caching in tight loop (advanced optimization)
   * ```typescript
   * async function processItems(items: Item[]) {
   *   // Cache context reference to avoid repeated getStore() calls
   *   const ctx = RequestContext.current();
   *   const traceId = ctx?.get('traceId');
   *
   *   for (const item of items) {
   *     // Use cached traceId instead of ctx.get('traceId') each time
   *     await processItem(item, traceId);
   *   }
   * }
   * ```
   */
  static current<T extends StruktosContextData = StruktosContextData>():
    | RequestContext<T>
    | undefined {
    const store = RequestContext.als.getStore();
    if (!store) {
      return undefined;
    }
    return new RequestContext<T>(store);
  }

  /**
   * Check if there's an active context.
   *
   * @returns True if a context is active, false otherwise
   *
   * @remarks
   * **Use Case:**
   *
   * This is useful for:
   * 1. Defensive coding - check before accessing context
   * 2. Conditional logic based on context presence
   * 3. Testing - verify context was set up correctly
   *
   * **More Efficient Than:**
   *
   * ```typescript
   * // ❌ Less efficient (creates wrapper instance)
   * if (RequestContext.current()) { ... }
   *
   * // ✅ More efficient (just checks store)
   * if (RequestContext.hasContext()) { ... }
   * ```
   *
   * @example Defensive logging
   * ```typescript
   * function logOperation(message: string) {
   *   if (RequestContext.hasContext()) {
   *     const ctx = RequestContext.current();
   *     const traceId = ctx?.get('traceId');
   *     console.log(message, { traceId });
   *   } else {
   *     console.log(message);
   *   }
   * }
   * ```
   *
   * @example Test assertion
   * ```typescript
   * it('should create context in middleware', () => {
   *   const app = createApp();
   *
   *   app.use((req, res, next) => {
   *     expect(RequestContext.hasContext()).toBe(true);
   *     next();
   *   });
   * });
   * ```
   */
  static hasContext(): boolean {
    return RequestContext.als.getStore() !== undefined;
  }

  // ==================== IContext Implementation ====================

  /**
   * Get a value from the context by key.
   *
   * {@inheritDoc IContext.get}
   */
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.store.data.get(key as string);
  }

  /**
   * Set a value in the context.
   *
   * {@inheritDoc IContext.set}
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.store.data.set(key as string, value);
  }

  /**
   * Check if a key exists in the context.
   *
   * {@inheritDoc IContext.has}
   */
  has<K extends keyof T>(key: K): boolean {
    return this.store.data.has(key as string);
  }

  /**
   * Delete a key from the context.
   *
   * {@inheritDoc IContext.delete}
   */
  delete<K extends keyof T>(key: K): boolean {
    return this.store.data.delete(key as string);
  }

  /**
   * Check if the context has been cancelled.
   *
   * {@inheritDoc IContext.isCancelled}
   */
  isCancelled(): boolean {
    return this.store.cancelled;
  }

  /**
   * Register a callback to be invoked when the context is cancelled.
   *
   * {@inheritDoc IContext.onCancel}
   */
  onCancel(callback: () => void): void {
    if (this.store.cancelled) {
      // If already cancelled, invoke immediately
      try {
        callback();
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    } else {
      this.store.cancelCallbacks.add(callback);
    }
  }

  /**
   * Cancel the context and invoke all registered callbacks.
   *
   * {@inheritDoc IContext.cancel}
   *
   * @remarks
   * **Implementation Details:**
   *
   * When cancel() is called:
   *
   * 1. **Idempotency Check**: If already cancelled, return early
   * 2. **Set Flag**: Mark `store.cancelled` as true
   * 3. **Execute Callbacks**: Invoke all registered callbacks in order
   * 4. **Error Handling**: Catch and log errors from callbacks (don't throw)
   * 5. **Cleanup**: Clear the callbacks set to prevent memory leaks
   *
   * **Error Isolation:**
   *
   * If one callback throws an error, other callbacks still run:
   *
   * ```typescript
   * ctx.onCancel(() => { throw new Error('Oops'); });
   * ctx.onCancel(() => { console.log('I still run!'); });
   *
   * ctx.cancel();
   * // Logs error from first callback
   * // Logs "I still run!" from second callback
   * ```
   */
  cancel(): void {
    if (this.store.cancelled) {
      return;
    }

    this.store.cancelled = true;

    // Invoke all registered callbacks
    for (const callback of this.store.cancelCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    }

    this.store.cancelCallbacks.clear();
  }

  /**
   * Get all context data as a readonly snapshot.
   *
   * {@inheritDoc IContext.getAll}
   *
   * @remarks
   * **Implementation Note:**
   *
   * This creates a new object each time it's called. For performance,
   * don't call this in tight loops. Cache the result if needed.
   *
   * ```typescript
   * // ❌ Inefficient
   * for (let i = 0; i < 10000; i++) {
   *   const all = ctx.getAll();  // Creates 10000 objects!
   *   console.log(all.traceId);
   * }
   *
   * // ✅ Efficient
   * const all = ctx.getAll();
   * for (let i = 0; i < 10000; i++) {
   *   console.log(all.traceId);  // Reuses same object
   * }
   * ```
   */
  getAll(): Readonly<Partial<T>> {
    const result: any = {};
    this.store.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Clone the current context with optional additional data.
   *
   * @param additionalData - Optional data to merge into the cloned context
   * @returns New RequestContext with cloned data
   *
   * @remarks
   * **Shallow Clone:**
   *
   * This creates a shallow clone of the context data:
   * - Primitive values: Copied by value
   * - Objects/Arrays: Copied by reference (shared with original)
   *
   * If you need deep cloning, manually clone objects before adding:
   *
   * ```typescript
   * const original = RequestContext.current();
   * const cloned = original?.clone({
   *   myObject: JSON.parse(JSON.stringify(original.get('myObject')))
   * });
   * ```
   *
   * **Cancellation State:**
   *
   * The cloned context:
   * - Does NOT inherit cancellation state (starts with `cancelled = false`)
   * - Does NOT share cancellation callbacks
   * - Is independent for cancellation purposes
   *
   * **Use Cases:**
   *
   * 1. **Child Operations**: Create derived context with additional metadata
   * 2. **Parallel Operations**: Run multiple operations with slightly different contexts
   * 3. **Testing**: Create context variations for test cases
   *
   * @example Child operation with additional metadata
   * ```typescript
   * RequestContext.run({ traceId: 'parent-123' }, async () => {
   *   const parentCtx = RequestContext.current();
   *
   *   // Create child context with additional data
   *   const childCtx = parentCtx?.clone({
   *     operationId: 'child-op-456',
   *     depth: 1,
   *   });
   *
   *   if (childCtx) {
   *     RequestContext.runWithContext(childCtx, async () => {
   *       const ctx = RequestContext.current();
   *       console.log(ctx?.get('traceId')); // 'parent-123' (inherited)
   *       console.log(ctx?.get('operationId')); // 'child-op-456' (added)
   *       console.log(ctx?.get('depth')); // 1 (added)
   *     });
   *   }
   * });
   * ```
   *
   * @example Parallel operations with variations
   * ```typescript
   * const baseCtx = RequestContext.current();
   *
   * await Promise.all([
   *   processWithContext(baseCtx?.clone({ variant: 'A' })),
   *   processWithContext(baseCtx?.clone({ variant: 'B' })),
   *   processWithContext(baseCtx?.clone({ variant: 'C' })),
   * ]);
   *
   * async function processWithContext(ctx: RequestContext | undefined) {
   *   if (!ctx) return;
   *   RequestContext.runWithContext(ctx, async () => {
   *     const current = RequestContext.current();
   *     console.log('Processing variant:', current?.get('variant'));
   *   });
   * }
   * ```
   */
  clone(additionalData?: Partial<T>): RequestContext<T> {
    const newStore: ContextStore = {
      data: new Map(this.store.data),
      cancelCallbacks: new Set(),
      cancelled: false,
    };

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        newStore.data.set(key, value);
      });
    }

    return new RequestContext<T>(newStore);
  }

  /**
   * Get the trace ID from context (convenience getter).
   *
   * @returns Trace ID string, or undefined if not set
   *
   * @remarks
   * **Convenience Method:**
   *
   * This is equivalent to `ctx.get('traceId')` but provides
   * a nicer API for the most commonly accessed field.
   *
   * **Type Safety:**
   *
   * Returns `string | undefined` regardless of your context type,
   * because traceId is a standard Struktos field.
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   *
   * // These are equivalent:
   * const trace1 = ctx?.traceId;
   * const trace2 = ctx?.get('traceId');
   * ```
   */
  get traceId(): string | undefined {
    return this.get('traceId' as keyof T) as string | undefined;
  }

  /**
   * Get the user ID from context (convenience getter).
   *
   * @returns User ID string, or undefined if not set
   *
   * @remarks
   * **Convenience Method:**
   *
   * This is equivalent to `ctx.get('userId')` but provides
   * a nicer API for the most commonly accessed field.
   *
   * **Authentication Check:**
   *
   * Use this to check if a user is authenticated:
   *
   * ```typescript
   * const ctx = RequestContext.current();
   * if (ctx?.userId) {
   *   // User is authenticated
   * } else {
   *   // Anonymous user
   * }
   * ```
   *
   * @example
   * ```typescript
   * const ctx = RequestContext.current();
   *
   * // These are equivalent:
   * const user1 = ctx?.userId;
   * const user2 = ctx?.get('userId');
   * ```
   */
  get userId(): string | undefined {
    return this.get('userId' as keyof T) as string | undefined;
  }
}

/**
 * Utility function to get current context or throw error.
 *
 * @template T - Context data type
 * @returns Current RequestContext (guaranteed to exist)
 * @throws Error if no context is active
 *
 * @remarks
 * **Use When:**
 *
 * Use this when your function REQUIRES a context to work.
 * It's like a non-null assertion for context.
 *
 * **Alternative to:**
 *
 * ```typescript
 * // ❌ Verbose
 * const ctx = RequestContext.current();
 * if (!ctx) {
 *   throw new Error('No context');
 * }
 *
 * // ✅ Concise
 * const ctx = getCurrentContext();
 * ```
 *
 * **Error Message:**
 *
 * The error message clearly indicates the problem and solution,
 * making debugging easier for developers.
 *
 * @example Function that requires context
 * ```typescript
 * async function auditedOperation(action: string) {
 *   // Will throw if called outside RequestContext.run()
 *   const ctx = getCurrentContext();
 *
 *   await logAudit({
 *     action,
 *     userId: ctx.get('userId'),
 *     traceId: ctx.get('traceId'),
 *     timestamp: Date.now(),
 *   });
 * }
 * ```
 *
 * @example With type parameter
 * ```typescript
 * interface MyContext extends StruktosContextData {
 *   customField: string;
 * }
 *
 * function processWithCustomContext() {
 *   const ctx = getCurrentContext<MyContext>();
 *   const custom = ctx.get('customField'); // Type-safe!
 * }
 * ```
 */
export function getCurrentContext<
  T extends StruktosContextData = StruktosContextData,
>(): RequestContext<T> {
  const context = RequestContext.current<T>();
  if (!context) {
    throw new Error(
      'No active context. Make sure you are within a RequestContext.run() scope.',
    );
  }
  return context;
}

/**
 * Utility function to safely get current context (returns null if none).
 *
 * @template T - Context data type
 * @returns Current RequestContext, or null if not active
 *
 * @remarks
 * **Use When:**
 *
 * Use this when context is optional for your function.
 * It's more explicit than checking for undefined.
 *
 * **Null vs Undefined:**
 *
 * This returns `null` instead of `undefined` to make null checks
 * more explicit in TypeScript's strict null checking mode.
 *
 * **Pattern:**
 *
 * ```typescript
 * const ctx = tryGetCurrentContext();
 * if (ctx) {
 *   // Context is available
 * } else {
 *   // Context is not available
 * }
 * ```
 *
 * @example Optional context usage
 * ```typescript
 * function logMessage(message: string) {
 *   const ctx = tryGetCurrentContext();
 *
 *   if (ctx) {
 *     // In a request context - include metadata
 *     console.log(message, {
 *       traceId: ctx.get('traceId'),
 *       userId: ctx.get('userId'),
 *     });
 *   } else {
 *     // Not in a request context - basic logging
 *     console.log(message);
 *   }
 * }
 * ```
 *
 * @example Background job
 * ```typescript
 * async function processJob(jobId: string) {
 *   // Background jobs might not have request context
 *   const ctx = tryGetCurrentContext();
 *
 *   console.log('Processing job', {
 *     jobId,
 *     traceId: ctx?.get('traceId') || 'background',
 *   });
 * }
 * ```
 */
export function tryGetCurrentContext<
  T extends StruktosContextData = StruktosContextData,
>(): RequestContext<T> | null {
  return RequestContext.current<T>() ?? null;
}

/**
 * Decorator for ensuring context exists in a method.
 *
 * @param _target - Target class prototype
 * @param _propertyKey - Method name
 * @param descriptor - Property descriptor
 * @returns Modified property descriptor
 *
 * @remarks
 * **Use Case:**
 *
 * Apply this decorator to methods that require a context.
 * It will automatically throw an error if the method is called
 * outside a RequestContext.run() scope.
 *
 * **How It Works:**
 *
 * 1. Decorator wraps the original method
 * 2. Wrapper checks for context before calling original
 * 3. If no context: throws error
 * 4. If context exists: calls original method
 *
 * **TypeScript Decorators:**
 *
 * Requires `experimentalDecorators: true` in tsconfig.json.
 *
 * **Error Message:**
 *
 * Includes the method name in the error message for easier debugging.
 *
 * @example Class with context-dependent methods
 * ```typescript
 * class UserService {
 *   @RequireContext
 *   async getUser(id: string) {
 *     // Context is guaranteed to exist here
 *     const ctx = RequestContext.current()!;
 *     const traceId = ctx.get('traceId');
 *
 *     return db.users.findById(id);
 *   }
 *
 *   @RequireContext
 *   async updateUser(id: string, data: any) {
 *     const ctx = RequestContext.current()!;
 *     // ... update logic
 *   }
 * }
 *
 * // Usage:
 * const service = new UserService();
 *
 * // ❌ Throws error (no context)
 * await service.getUser('123');
 *
 * // ✅ Works (has context)
 * RequestContext.run({}, async () => {
 *   await service.getUser('123');
 * });
 * ```
 *
 * @example With custom error handling
 * ```typescript
 * class AuditService {
 *   @RequireContext
 *   async logAction(action: string) {
 *     try {
 *       const ctx = getCurrentContext();
 *       await this.writeAuditLog({
 *         action,
 *         userId: ctx.get('userId'),
 *         timestamp: Date.now(),
 *       });
 *     } catch (error) {
 *       if (error.message.includes('active RequestContext')) {
 *         // Handle missing context
 *         logger.warn('Audit log attempted without context', { action });
 *       } else {
 *         throw error;
 *       }
 *     }
 *   }
 * }
 * ```
 */
export function RequireContext(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    if (!RequestContext.hasContext()) {
      throw new Error(`Method requires an active RequestContext`);
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}
