/**
 * @fileoverview Pipeline Builder - Middleware Composition Utilities
 * 
 * @packageDocumentation
 * @module @struktos/core/infrastructure/pipeline
 * 
 * ## Hexagonal Architecture Layer: INFRASTRUCTURE
 * 
 * This file belongs to the **Infrastructure Layer**, which handles
 * external concerns and technical implementations.
 * 
 * Infrastructure layer:
 * - ✅ **CAN**: Implement technical patterns (pipelines, caching, etc.)
 * - ✅ **CAN**: Depend on external libraries
 * - ✅ **CAN**: Import from Domain and Application layers
 * - ❌ **CANNOT**: Contain business logic
 * - ❌ **CANNOT**: Define domain entities
 * 
 * ## Architectural Responsibility
 * 
 * This module provides utilities for **composing middleware pipelines**.
 * A pipeline is an ordered sequence of middleware that processes requests:
 * 
 * ```
 * Request  →  [Middleware 1]  →  [Middleware 2]  →  [Middleware 3]  →  Response
 * ```
 * 
 * ## The Middleware Pattern (Chain of Responsibility)
 * 
 * Middleware follows the **Chain of Responsibility** design pattern:
 * 
 * ```typescript
 * async function middleware(ctx, next) {
 *   // 1. Do something BEFORE next middleware
 *   console.log('Before');
 *   
 *   // 2. Call next middleware in chain
 *   await next();
 *   
 *   // 3. Do something AFTER next middleware completes
 *   console.log('After');
 * }
 * ```
 * 
 * This creates an "onion model" where execution flows inward, then back outward:
 * 
 * ```
 * MW1 Before  →  MW2 Before  →  MW3 Before  →  Handler
 *     ↓              ↓              ↓              ↓
 * MW1 After   ←  MW2 After   ←  MW3 After   ←  Response
 * ```
 * 
 * ## Why Pipeline Composition?
 * 
 * **Without Pipeline Builder:**
 * 
 * ```typescript
 * // ❌ Manual, error-prone, hard to reuse
 * app.use((ctx, next) => {
 *   // Logging
 *   console.log('Request');
 *   return next().then(() => console.log('Response'));
 * });
 * 
 * app.use((ctx, next) => {
 *   // Authentication
 *   if (!ctx.user) throw new Error('Unauthorized');
 *   return next();
 * });
 * 
 * app.use((ctx, next) => {
 *   // Rate limiting
 *   if (isRateLimited(ctx)) throw new Error('Too many requests');
 *   return next();
 * });
 * ```
 * 
 * **With Pipeline Builder:**
 * 
 * ```typescript
 * // ✅ Declarative, reusable, composable
 * const pipeline = createPipeline()
 *   .use(new LoggingMiddleware())
 *   .use(new AuthMiddleware())
 *   .use(new RateLimitMiddleware())
 *   .compose();
 * ```
 * 
 * ## Advanced Composition Patterns
 * 
 * Pipeline Builder supports several advanced patterns:
 * 
 * 1. **Conditional Execution**: `useIf()`, `branch()`
 * 2. **Method-Specific**: `forMethods()` - only for POST, GET, etc.
 * 3. **Path-Specific**: `forPaths()` - only for /api/*, /admin/*, etc.
 * 4. **Parallel Execution**: `parallel()` - run middlewares concurrently
 * 5. **Resilience**: `withRetry()`, `withTimeout()` - fault tolerance
 * 6. **Error Handling**: `wrapErrors()` - centralized error handling
 * 
 * @see {@link https://en.wikipedia.org/wiki/Chain-of-responsibility_pattern | Chain of Responsibility Pattern}
 * @see {@link https://expressjs.com/en/guide/using-middleware.html | Express Middleware}
 * @version 1.0.0
 */

import { StruktosContextData } from '../../domain/context';
import { 
  IStruktosMiddleware, 
  MiddlewareFunction, 
  createMiddleware,
  MiddlewareContext,
  NextFunction 
} from '../platform/middleware';

/**
 * Pipeline builder for composing middlewares with fluent API.
 * 
 * @template T - Context data type extending StruktosContextData
 * 
 * @remarks
 * **Design Pattern: Builder**
 * 
 * This class implements the **Builder Pattern** for constructing middleware pipelines:
 * 
 * 1. **Fluent API**: Methods return `this` for method chaining
 * 2. **Incremental Construction**: Add middlewares one at a time
 * 3. **Immutability of Result**: `build()` returns a copy, `compose()` creates new middleware
 * 4. **Separation of Construction**: Pipeline building is separate from execution
 * 
 * **Internal State:**
 * 
 * ```typescript
 * class PipelineBuilder {
 *   private middlewares: IStruktosMiddleware[] = [];  // Ordered list
 * }
 * ```
 * 
 * Each method modifies this internal array, then returns `this` for chaining.
 * 
 * **The Magic of `compose()`:**
 * 
 * The `compose()` method is where the real magic happens. It takes
 * an array of middlewares and creates a single composed middleware:
 * 
 * ```typescript
 * // Before compose():
 * [MW1, MW2, MW3]  // Array of separate middlewares
 * 
 * // After compose():
 * ComposedMiddleware  // Single middleware that runs all three in order
 * 
 * // When invoked:
 * ComposedMiddleware.invoke(ctx, finalNext)
 *   → MW1.invoke(ctx, () => 
 *       MW2.invoke(ctx, () => 
 *         MW3.invoke(ctx, () => 
 *           finalNext())))
 * ```
 * 
 * **How Composition Works Internally:**
 * 
 * ```typescript
 * compose(): IStruktosMiddleware<T> {
 *   const middlewares = this.build();  // Get copy of middleware array
 *   
 *   return createMiddleware<T>(async (ctx, next) => {
 *     let index = 0;  // Track position in middleware array
 *     
 *     // Recursive dispatch function
 *     const dispatch = async (): Promise<void> => {
 *       if (index < middlewares.length) {
 *         const middleware = middlewares[index++];  // Get next middleware
 *         await middleware.invoke(ctx, dispatch);   // Pass dispatch as 'next'
 *       } else {
 *         await next();  // All middlewares done, call final next
 *       }
 *     };
 *     
 *     await dispatch();  // Start the chain
 *   });
 * }
 * ```
 * 
 * **Visualization of Execution Flow:**
 * 
 * ```
 * User calls: pipeline.invoke(ctx, finalHandler)
 *   ↓
 * ComposedMiddleware receives: (ctx, finalHandler)
 *   ↓
 * dispatch() called
 *   ↓ index=0
 * MW1.invoke(ctx, dispatch)
 *   ↓ MW1 before
 *   ↓ MW1 calls next() → dispatch()
 *   ↓ index=1
 * MW2.invoke(ctx, dispatch)
 *   ↓ MW2 before
 *   ↓ MW2 calls next() → dispatch()
 *   ↓ index=2
 * MW3.invoke(ctx, dispatch)
 *   ↓ MW3 before
 *   ↓ MW3 calls next() → dispatch()
 *   ↓ index=3 (>= length)
 *   ↓ dispatch calls finalHandler()
 *   ↑ finalHandler completes
 *   ↑ MW3 after
 * MW3.invoke returns
 *   ↑ MW2 after
 * MW2.invoke returns
 *   ↑ MW1 after
 * MW1.invoke returns
 *   ↑
 * Done!
 * ```
 * 
 * **Why This Pattern?**
 * 
 * - ✅ **Flexibility**: Add/remove middlewares dynamically
 * - ✅ **Reusability**: Build pipeline once, use many times
 * - ✅ **Testability**: Test individual middlewares or full pipeline
 * - ✅ **Maintainability**: Clear structure, easy to understand
 * - ✅ **Performance**: Zero overhead vs. manual chaining
 * 
 * @example Basic pipeline
 * ```typescript
 * const pipeline = new PipelineBuilder()
 *   .use(new LoggingMiddleware())
 *   .use(new AuthMiddleware())
 *   .use(new ValidationMiddleware())
 *   .compose();
 * 
 * // Use in handler
 * await pipeline.invoke(ctx, async () => {
 *   // Your handler logic
 * });
 * ```
 * 
 * @example Conditional middlewares
 * ```typescript
 * const isDevelopment = process.env.NODE_ENV === 'development';
 * 
 * const pipeline = new PipelineBuilder()
 *   .use(new TimingMiddleware())
 *   .useIf(isDevelopment, new DebugMiddleware())
 *   .useIf(!isDevelopment, new CompressionMiddleware())
 *   .compose();
 * ```
 * 
 * @example Dynamic pipeline construction
 * ```typescript
 * const builder = new PipelineBuilder();
 * 
 * // Base middlewares
 * builder.use(new CorsMiddleware());
 * 
 * // Add auth only if required
 * if (config.requireAuth) {
 *   builder.use(new AuthMiddleware());
 * }
 * 
 * // Add rate limiting in production
 * if (config.isProduction) {
 *   builder.use(new RateLimitMiddleware({ max: 100 }));
 * }
 * 
 * const pipeline = builder.compose();
 * ```
 */
export class PipelineBuilder<T extends StruktosContextData = StruktosContextData> {
  /**
   * Ordered list of middlewares in this pipeline.
   * 
   * @remarks
   * **Order Matters:**
   * 
   * Middlewares execute in the order they're added:
   * 
   * ```typescript
   * builder
   *   .use(MW1)  // Executes FIRST (before)
   *   .use(MW2)  // Executes SECOND (before)
   *   .use(MW3); // Executes THIRD (before)
   * 
   * // Execution flow:
   * MW1 before → MW2 before → MW3 before → Handler → MW3 after → MW2 after → MW1 after
   * ```
   * 
   * **Common Ordering Patterns:**
   * 
   * 1. **Logging** - First (capture everything)
   * 2. **Error Handling** - Second (catch all errors)
   * 3. **Authentication** - Third (verify user)
   * 4. **Authorization** - Fourth (check permissions)
   * 5. **Validation** - Fifth (validate inputs)
   * 6. **Business Logic** - Last
   * 
   * **Performance Note:**
   * 
   * This is a simple array, so:
   * - Adding: O(1) amortized
   * - Removing: O(n)
   * - Building: O(n)
   * 
   * @private
   */
  private middlewares: IStruktosMiddleware<T>[] = [];

  /**
   * Add middleware to the end of the pipeline.
   * 
   * @param middleware - Middleware to add (object or function)
   * @returns This builder for chaining
   * 
   * @remarks
   * **Accepts Two Forms:**
   * 
   * 1. **Middleware Object** (implements IStruktosMiddleware):
   * 
   * ```typescript
   * class MyMiddleware implements IStruktosMiddleware {
   *   async invoke(ctx, next) {
   *     // ...
   *   }
   * }
   * 
   * builder.use(new MyMiddleware());
   * ```
   * 
   * 2. **Middleware Function** (simpler, for one-offs):
   * 
   * ```typescript
   * builder.use(async (ctx, next) => {
   *   console.log('Before');
   *   await next();
   *   console.log('After');
   * });
   * ```
   * 
   * **Automatic Wrapping:**
   * 
   * Functions are automatically wrapped using `createMiddleware()`:
   * 
   * ```typescript
   * // Function → Object conversion happens here
   * if (typeof middleware === 'function') {
   *   this.middlewares.push(createMiddleware(middleware));
   * }
   * ```
   * 
   * **Fluent API:**
   * 
   * Returns `this` to enable method chaining:
   * 
   * ```typescript
   * builder
   *   .use(mw1)
   *   .use(mw2)
   *   .use(mw3)
   *   .compose();
   * ```
   * 
   * @example Using middleware objects
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(new LoggingMiddleware())
   *   .use(new AuthMiddleware({ required: true }))
   *   .use(new ValidationMiddleware(schema))
   *   .compose();
   * ```
   * 
   * @example Using inline functions
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(async (ctx, next) => {
   *     console.log(`Request: ${ctx.request.method} ${ctx.request.path}`);
   *     const start = Date.now();
   *     await next();
   *     console.log(`Duration: ${Date.now() - start}ms`);
   *   })
   *   .use(async (ctx, next) => {
   *     if (!ctx.context.get('userId')) {
   *       throw new Error('Unauthorized');
   *     }
   *     await next();
   *   })
   *   .compose();
   * ```
   * 
   * @example Mixing objects and functions
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(new CorsMiddleware())  // Reusable object
   *   .use(async (ctx, next) => {  // One-off function
   *     ctx.items.set('requestId', generateId());
   *     await next();
   *   })
   *   .use(new AuthMiddleware())  // Reusable object
   *   .compose();
   * ```
   */
  use(middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    if (typeof middleware === 'function') {
      this.middlewares.push(createMiddleware(middleware));
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Add middleware conditionally based on boolean or function.
   * 
   * @param condition - Boolean value or function returning boolean
   * @param middleware - Middleware to add if condition is true
   * @returns This builder for chaining
   * 
   * @remarks
   * **Use Cases:**
   * 
   * 1. **Environment-Based**: Different middlewares for dev/prod
   * 2. **Feature Flags**: Enable/disable middlewares dynamically
   * 3. **Configuration**: Add middlewares based on config
   * 
   * **Lazy Evaluation:**
   * 
   * If condition is a function, it's evaluated immediately (not lazily):
   * 
   * ```typescript
   * // Evaluated NOW (when builder is constructed)
   * builder.useIf(() => config.isEnabled(), middleware);
   * 
   * // NOT evaluated later when pipeline runs
   * ```
   * 
   * For dynamic runtime conditions, use `branch()` instead.
   * 
   * **Short-Circuit:**
   * 
   * If condition is false, the middleware is not added at all:
   * 
   * ```typescript
   * builder
   *   .useIf(false, expensiveMiddleware)  // Not added
   *   .compose();
   * 
   * // Final pipeline has 0 middlewares, zero overhead
   * ```
   * 
   * @example Environment-based inclusion
   * ```typescript
   * const isDev = process.env.NODE_ENV === 'development';
   * 
   * const pipeline = new PipelineBuilder()
   *   .use(new CorsMiddleware())
   *   .useIf(isDev, new DebugMiddleware())
   *   .useIf(isDev, new RequestLoggerMiddleware())
   *   .useIf(!isDev, new CompressionMiddleware())
   *   .compose();
   * ```
   * 
   * @example Feature flag-based inclusion
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(new AuthMiddleware())
   *   .useIf(
   *     featureFlags.isEnabled('rate-limiting'),
   *     new RateLimitMiddleware()
   *   )
   *   .useIf(
   *     featureFlags.isEnabled('request-tracing'),
   *     new TracingMiddleware()
   *   )
   *   .compose();
   * ```
   * 
   * @example Function-based condition
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .useIf(
   *     () => config.getSetting('enableCache') === true,
   *     new CacheMiddleware()
   *   )
   *   .useIf(
   *     () => config.getSetting('minify') === true,
   *     new MinifyMiddleware()
   *   )
   *   .compose();
   * ```
   */
  useIf(
    condition: boolean | (() => boolean),
    middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>
  ): this {
    const shouldUse = typeof condition === 'function' ? condition() : condition;
    if (shouldUse) {
      this.use(middleware);
    }
    return this;
  }

  /**
   * Add middleware at the beginning of the pipeline.
   * 
   * @param middleware - Middleware to prepend
   * @returns This builder for chaining
   * 
   * @remarks
   * **When to Use:**
   * 
   * Use `prepend()` when you need a middleware to run before all existing ones:
   * 
   * - **Error handlers** - Catch errors from all other middlewares
   * - **Request IDs** - Set up before anything else logs
   * - **Security headers** - Apply before processing
   * 
   * **Order After Prepend:**
   * 
   * ```typescript
   * builder
   *   .use(MW2)
   *   .use(MW3)
   *   .prepend(MW1);
   * 
   * // Final order: [MW1, MW2, MW3]
   * ```
   * 
   * **Multiple Prepends:**
   * 
   * Multiple prepends maintain relative order:
   * 
   * ```typescript
   * builder
   *   .use(MW3)
   *   .prepend(MW2)
   *   .prepend(MW1);
   * 
   * // Final order: [MW1, MW2, MW3]
   * ```
   * 
   * **Performance:**
   * 
   * `prepend()` is O(n) because it shifts all existing middlewares.
   * If you need many prepends, consider adding them in reverse order with `use()`.
   * 
   * @example Error handler at start
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(new AuthMiddleware())
   *   .use(new ValidationMiddleware())
   *   .prepend(new ErrorHandlerMiddleware())  // Catches errors from auth & validation
   *   .compose();
   * ```
   * 
   * @example Request ID generation
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(new LoggingMiddleware())  // Needs requestId
   *   .use(new TracingMiddleware())  // Needs requestId
   *   .prepend(async (ctx, next) => {
   *     ctx.items.set('requestId', generateId());
   *     await next();
   *   })
   *   .compose();
   * ```
   */
  prepend(middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;
    this.middlewares.unshift(mw);
    return this;
  }

  /**
   * Add middleware at a specific position.
   * 
   * @param index - Zero-based index where to insert
   * @param middleware - Middleware to insert
   * @returns This builder for chaining
   * 
   * @remarks
   * **Use Case:**
   * 
   * Rarely needed, but useful when you need precise control over
   * middleware ordering (e.g., plugin systems, dynamic injection).
   * 
   * **Index Behavior:**
   * 
   * - `index=0`: Same as `prepend()` - inserts at start
   * - `index=length`: Same as `use()` - appends at end
   * - Negative indices: Not supported, will cause issues
   * 
   * **Example Positions:**
   * 
   * ```typescript
   * builder.use(MW1).use(MW2).use(MW3);
   * // Current: [MW1, MW2, MW3]
   * 
   * builder.insertAt(0, MW0);  // [MW0, MW1, MW2, MW3]
   * builder.insertAt(2, MWX);  // [MW0, MW1, MWX, MW2, MW3]
   * builder.insertAt(5, MW4);  // [MW0, MW1, MWX, MW2, MW3, MW4]
   * ```
   * 
   * **Performance:**
   * 
   * O(n) because arrays must shift elements. Avoid in hot paths.
   * 
   * @example Plugin system
   * ```typescript
   * class PluginManager {
   *   private builder = new PipelineBuilder();
   *   
   *   registerPlugin(plugin: Plugin, priority: number) {
   *     // Higher priority = earlier in pipeline
   *     const position = this.calculatePosition(priority);
   *     this.builder.insertAt(position, plugin.middleware);
   *   }
   * }
   * ```
   * 
   * @example Dynamic middleware injection
   * ```typescript
   * function injectMiddleware(
   *   builder: PipelineBuilder,
   *   middleware: IStruktosMiddleware,
   *   after: string
   * ) {
   *   const middlewares = builder.build();
   *   const index = middlewares.findIndex(
   *     mw => mw.constructor.name === after
   *   );
   *   
   *   if (index !== -1) {
   *     builder.insertAt(index + 1, middleware);
   *   }
   * }
   * ```
   */
  insertAt(index: number, middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;
    this.middlewares.splice(index, 0, mw);
    return this;
  }

  /**
   * Build the pipeline as an array of middlewares.
   * 
   * @returns Copy of the middleware array
   * 
   * @remarks
   * **Immutability:**
   * 
   * Returns a **shallow copy** of the middleware array:
   * 
   * ```typescript
   * const array1 = builder.build();
   * const array2 = builder.build();
   * 
   * console.log(array1 === array2);  // false (different arrays)
   * console.log(array1[0] === array2[0]);  // true (same middlewares)
   * ```
   * 
   * This prevents external modification of the builder's internal state:
   * 
   * ```typescript
   * const array = builder.build();
   * array.push(maliciousMiddleware);  // Doesn't affect builder!
   * ```
   * 
   * **When to Use:**
   * 
   * - Inspecting the pipeline (debugging, testing)
   * - Passing to manual composition logic
   * - Creating variants of a pipeline
   * 
   * **Prefer `compose()` for Normal Use:**
   * 
   * Unless you need the raw array, use `compose()` instead:
   * 
   * ```typescript
   * // ❌ Manual iteration (unnecessary)
   * const middlewares = builder.build();
   * for (const mw of middlewares) {
   *   await mw.invoke(ctx, next);
   * }
   * 
   * // ✅ Use composed middleware
   * const composed = builder.compose();
   * await composed.invoke(ctx, next);
   * ```
   * 
   * @example Inspecting pipeline
   * ```typescript
   * const builder = new PipelineBuilder()
   *   .use(new MW1())
   *   .use(new MW2())
   *   .use(new MW3());
   * 
   * const middlewares = builder.build();
   * console.log('Pipeline has', middlewares.length, 'middlewares');
   * middlewares.forEach(mw => {
   *   console.log('Middleware:', mw.constructor.name);
   * });
   * ```
   * 
   * @example Creating variants
   * ```typescript
   * const baseBuilder = new PipelineBuilder()
   *   .use(new CorsMiddleware())
   *   .use(new LoggingMiddleware());
   * 
   * // Create authenticated variant
   * const authBuilder = new PipelineBuilder();
   * baseBuilder.build().forEach(mw => authBuilder.use(mw));
   * authBuilder.use(new AuthMiddleware());
   * 
   * // Create public variant (no auth)
   * const publicBuilder = new PipelineBuilder();
   * baseBuilder.build().forEach(mw => publicBuilder.use(mw));
   * ```
   */
  build(): IStruktosMiddleware<T>[] {
    return [...this.middlewares];
  }

  /**
   * Build and return a single composed middleware.
   * 
   * @returns Single middleware that executes all middlewares in order
   * 
   * @remarks
   * **This is the Key Method!**
   * 
   * `compose()` is where the pipeline becomes a single, executable middleware.
   * 
   * **Internal Implementation Explained:**
   * 
   * ```typescript
   * compose(): IStruktosMiddleware<T> {
   *   const middlewares = this.build();  // [MW1, MW2, MW3]
   *   
   *   // Create a new middleware that wraps all of them
   *   return createMiddleware<T>(async (ctx, next) => {
   *     let index = 0;  // Current position in middleware array
   *     
   *     // Recursive dispatcher - the heart of composition
   *     const dispatch = async (): Promise<void> => {
   *       if (index < middlewares.length) {
   *         // More middlewares to run
   *         const middleware = middlewares[index++];
   *         
   *         // Key: Pass dispatch as the 'next' function
   *         // When middleware calls next(), it actually calls dispatch()
   *         await middleware.invoke(ctx, dispatch);
   *       } else {
   *         // All middlewares done, call the final next()
   *         await next();
   *       }
   *     };
   *     
   *     await dispatch();  // Start the chain
   *   });
   * }
   * ```
   * 
   * **Visual Execution Flow:**
   * 
   * Given: `[MW1, MW2, MW3]`
   * 
   * ```
   * compose() returns: ComposedMiddleware
   *   ↓
   * User calls: ComposedMiddleware.invoke(ctx, finalHandler)
   *   ↓
   * dispatch() [index=0]
   *   ↓
   * MW1.invoke(ctx, dispatch)
   *   MW1 before...
   *   await dispatch()  ← MW1 calls next(), which is dispatch()
   *     ↓
   *   dispatch() [index=1]
   *     ↓
   *   MW2.invoke(ctx, dispatch)
   *     MW2 before...
   *     await dispatch()  ← MW2 calls next(), which is dispatch()
   *       ↓
   *     dispatch() [index=2]
   *       ↓
   *     MW3.invoke(ctx, dispatch)
   *       MW3 before...
   *       await dispatch()  ← MW3 calls next(), which is dispatch()
   *         ↓
   *       dispatch() [index=3, >= length]
   *         ↓
   *       await finalHandler()  ← All middlewares done, call final handler
   *         ↓
   *       finalHandler completes
   *       ↑
   *       MW3 after...
   *     MW3.invoke completes
   *       ↑
   *     MW2 after...
   *   MW2.invoke completes
   *     ↑
   *   MW1 after...
   * MW1.invoke completes
   *   ↑
   * ComposedMiddleware.invoke completes
   * ```
   * 
   * **Why This Design:**
   * 
   * - ✅ **Elegant**: Simple recursive pattern
   * - ✅ **Efficient**: No extra allocations, no complex state
   * - ✅ **Flexible**: Each middleware controls when to call next()
   * - ✅ **Error-Safe**: Errors propagate naturally through promises
   * 
   * **Performance:**
   * 
   * - Composition itself: O(1) - just wraps in a function
   * - Execution: O(n) - must run all n middlewares
   * - Memory: O(1) - only stores one index variable
   * 
   * @example Basic composition
   * ```typescript
   * const pipeline = new PipelineBuilder()
   *   .use(async (ctx, next) => {
   *     console.log('1 before');
   *     await next();
   *     console.log('1 after');
   *   })
   *   .use(async (ctx, next) => {
   *     console.log('2 before');
   *     await next();
   *     console.log('2 after');
   *   })
   *   .compose();
   * 
   * await pipeline.invoke(ctx, async () => {
   *   console.log('handler');
   * });
   * 
   * // Output:
   * // 1 before
   * // 2 before
   * // handler
   * // 2 after
   * // 1 after
   * ```
   * 
   * @example Reusing composed pipeline
   * ```typescript
   * const authPipeline = new PipelineBuilder()
   *   .use(new CorsMiddleware())
   *   .use(new AuthMiddleware())
   *   .use(new ValidationMiddleware())
   *   .compose();
   * 
   * // Use in multiple routes
   * app.get('/api/users', async (req, res) => {
   *   await authPipeline.invoke(ctx, async () => {
   *     // Handler logic
   *   });
   * });
   * 
   * app.post('/api/users', async (req, res) => {
   *   await authPipeline.invoke(ctx, async () => {
   *     // Handler logic
   *   });
   * });
   * ```
   */
  compose(): IStruktosMiddleware<T> {
    const middlewares = this.build();
    
    return createMiddleware<T>(async (ctx: MiddlewareContext<T>, next: NextFunction) => {
      let index = 0;

      const dispatch = async (): Promise<void> => {
        if (index < middlewares.length) {
          const middleware = middlewares[index++];
          await middleware.invoke(ctx, dispatch);
        } else {
          await next();
        }
      };

      await dispatch();
    });
  }

  /**
   * Get the number of middlewares in the pipeline.
   * 
   * @returns Number of middlewares
   * 
   * @remarks
   * **Use Cases:**
   * 
   * - Debugging: Check if middlewares were added
   * - Testing: Verify correct number of middlewares
   * - Logging: Report pipeline size
   * - Validation: Ensure minimum/maximum middlewares
   * 
   * @example Validation
   * ```typescript
   * const builder = new PipelineBuilder()
   *   .use(new MW1())
   *   .use(new MW2());
   * 
   * if (builder.length < 3) {
   *   console.warn('Pipeline has fewer than 3 middlewares');
   * }
   * 
   * console.log(`Pipeline size: ${builder.length} middlewares`);
   * ```
   * 
   * @example Testing
   * ```typescript
   * it('should add exactly 5 middlewares', () => {
   *   const builder = createStandardPipeline();
   *   expect(builder.length).toBe(5);
   * });
   * ```
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * Clear all middlewares from the pipeline.
   * 
   * @returns This builder for chaining
   * 
   * @remarks
   * **Use Cases:**
   * 
   * - Reusing a builder for different pipelines
   * - Testing: Reset between test cases
   * - Dynamic reconfiguration
   * 
   * **Creates New Array:**
   * 
   * This replaces the internal array completely:
   * 
   * ```typescript
   * const oldArray = builder.build();
   * builder.clear();
   * const newArray = builder.build();
   * 
   * console.log(oldArray === newArray);  // false
   * console.log(newArray.length);  // 0
   * ```
   * 
   * @example Reusing builder
   * ```typescript
   * const builder = new PipelineBuilder();
   * 
   * // First pipeline
   * builder.use(new MW1()).use(new MW2());
   * const pipeline1 = builder.compose();
   * 
   * // Clear and create second pipeline
   * builder.clear();
   * builder.use(new MW3()).use(new MW4());
   * const pipeline2 = builder.compose();
   * ```
   * 
   * @example Testing
   * ```typescript
   * describe('Pipeline', () => {
   *   let builder: PipelineBuilder;
   *   
   *   beforeEach(() => {
   *     builder = new PipelineBuilder();
   *   });
   *   
   *   afterEach(() => {
   *     builder.clear();  // Clean state between tests
   *   });
   * });
   * ```
   */
  clear(): this {
    this.middlewares = [];
    return this;
  }
}

/**
 * Create a new pipeline builder.
 * 
 * @template T - Context data type
 * @returns New PipelineBuilder instance
 * 
 * @remarks
 * **Factory Function Pattern:**
 * 
 * This is a factory function that creates PipelineBuilder instances.
 * It's more convenient than using `new PipelineBuilder<T>()`:
 * 
 * ```typescript
 * // ✅ Cleaner
 * const pipeline = createPipeline()
 *   .use(middleware)
 *   .compose();
 * 
 * // ❌ More verbose
 * const pipeline = new PipelineBuilder<MyContextData>()
 *   .use(middleware)
 *   .compose();
 * ```
 * 
 * **Type Inference:**
 * 
 * TypeScript can infer the type parameter from usage:
 * 
 * ```typescript
 * // Type is inferred from middleware
 * const pipeline = createPipeline()
 *   .use(myTypedMiddleware)  // T inferred here
 *   .compose();
 * ```
 * 
 * @example Standard usage
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(new LoggingMiddleware())
 *   .use(new AuthMiddleware())
 *   .compose();
 * ```
 * 
 * @example With explicit type
 * ```typescript
 * interface MyContext extends StruktosContextData {
 *   customField: string;
 * }
 * 
 * const pipeline = createPipeline<MyContext>()
 *   .use(async (ctx, next) => {
 *     const field = ctx.context.get('customField');  // Type-safe!
 *     await next();
 *   })
 *   .compose();
 * ```
 */
export function createPipeline<T extends StruktosContextData = StruktosContextData>(): PipelineBuilder<T> {
  return new PipelineBuilder<T>();
}

/**
 * Compose multiple middlewares into a single middleware.
 * 
 * @template T - Context data type
 * @param middlewares - Middlewares to compose (objects or functions)
 * @returns Single composed middleware
 * 
 * @remarks
 * **Convenience Function:**
 * 
 * This is a convenience function equivalent to:
 * 
 * ```typescript
 * createPipeline()
 *   .use(mw1)
 *   .use(mw2)
 *   .use(mw3)
 *   .compose();
 * ```
 * 
 * **Use When:**
 * 
 * - You have a fixed set of middlewares
 * - You don't need conditional/dynamic composition
 * - You want a quick one-liner
 * 
 * **Variadic Arguments:**
 * 
 * Takes any number of arguments using rest parameters:
 * 
 * ```typescript
 * compose(mw1);  // 1 middleware
 * compose(mw1, mw2);  // 2 middlewares
 * compose(mw1, mw2, mw3, mw4, mw5);  // 5 middlewares
 * ```
 * 
 * @example Quick composition
 * ```typescript
 * const pipeline = compose(
 *   new CorsMiddleware(),
 *   new LoggingMiddleware(),
 *   new AuthMiddleware()
 * );
 * 
 * await pipeline.invoke(ctx, handler);
 * ```
 * 
 * @example Mixing objects and functions
 * ```typescript
 * const pipeline = compose(
 *   new TimingMiddleware(),
 *   async (ctx, next) => {
 *     ctx.items.set('startTime', Date.now());
 *     await next();
 *   },
 *   new ValidationMiddleware()
 * );
 * ```
 * 
 * @example Higher-order composition
 * ```typescript
 * function createAuthenticatedPipeline(...extraMiddlewares: IStruktosMiddleware[]) {
 *   return compose(
 *     new CorsMiddleware(),
 *     new AuthMiddleware(),
 *     ...extraMiddlewares
 *   );
 * }
 * 
 * const userPipeline = createAuthenticatedPipeline(
 *   new ValidationMiddleware(userSchema)
 * );
 * 
 * const adminPipeline = createAuthenticatedPipeline(
 *   new AdminCheckMiddleware(),
 *   new AuditMiddleware()
 * );
 * ```
 */
export function compose<T extends StruktosContextData = StruktosContextData>(
  ...middlewares: Array<IStruktosMiddleware<T> | MiddlewareFunction<T>>
): IStruktosMiddleware<T> {
  const pipeline = createPipeline<T>();
  for (const middleware of middlewares) {
    pipeline.use(middleware);
  }
  return pipeline.compose();
}

/**
 * Create a branching middleware that runs different pipelines based on condition.
 * 
 * @template T - Context data type
 * @param condition - Function that returns true for ifTrue branch, false for ifFalse
 * @param ifTrue - Middleware to run if condition returns true
 * @param ifFalse - Optional middleware to run if condition returns false
 * @returns Branching middleware
 * 
 * @remarks
 * **Runtime Branching:**
 * 
 * Unlike `useIf()` which decides at pipeline construction time,
 * `branch()` decides at request time based on the context:
 * 
 * ```typescript
 * // ❌ Build-time decision (useIf)
 * builder.useIf(config.isProduction, productionMiddleware);
 * 
 * // ✅ Runtime decision (branch)
 * builder.use(branch(
 *   ctx => ctx.request.path.startsWith('/admin'),
 *   adminMiddleware,
 *   publicMiddleware
 * ));
 * ```
 * 
 * **Condition Function:**
 * 
 * The condition receives the full MiddlewareContext:
 * 
 * ```typescript
 * (ctx: MiddlewareContext<T>) => boolean
 * ```
 * 
 * You can inspect:
 * - Request: `ctx.request.method`, `ctx.request.path`, `ctx.request.headers`
 * - Context: `ctx.context.get('userId')`, etc.
 * - Items: `ctx.items.get('someFlag')`
 * 
 * **Fallthrough Behavior:**
 * 
 * If `ifFalse` is not provided and condition is false:
 * 
 * ```typescript
 * branch(condition, ifTrue)  // No ifFalse
 * 
 * // If condition is false:
 * //   - Skip ifTrue middleware
 * //   - Call next() immediately (fallthrough)
 * ```
 * 
 * **Performance:**
 * 
 * The condition function is called on EVERY request.
 * Keep it fast - avoid expensive operations like database queries.
 * 
 * @example Route-based branching
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(branch(
 *     ctx => ctx.request.path.startsWith('/api/admin'),
 *     new AdminAuthMiddleware(),
 *     new PublicAuthMiddleware()
 *   ))
 *   .compose();
 * ```
 * 
 * @example Method-based branching
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(branch(
 *     ctx => ctx.request.method === 'POST',
 *     new CSRFMiddleware()  // Only for POST requests
 *   ))
 *   .compose();
 * ```
 * 
 * @example User role-based branching
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(new AuthMiddleware())
 *   .use(branch(
 *     ctx => {
 *       const roles = ctx.context.get('roles');
 *       return roles?.includes('admin');
 *     },
 *     compose(
 *       new AdminLoggingMiddleware(),
 *       new AdminValidationMiddleware()
 *     ),
 *     new StandardValidationMiddleware()
 *   ))
 *   .compose();
 * ```
 */
export function branch<T extends StruktosContextData = StruktosContextData>(
  condition: (ctx: MiddlewareContext<T>) => boolean,
  ifTrue: IStruktosMiddleware<T> | MiddlewareFunction<T>,
  ifFalse?: IStruktosMiddleware<T> | MiddlewareFunction<T>
): IStruktosMiddleware<T> {
  const trueMw = typeof ifTrue === 'function' ? createMiddleware(ifTrue) : ifTrue;
  const falseMw = ifFalse
    ? typeof ifFalse === 'function'
      ? createMiddleware(ifFalse)
      : ifFalse
    : null;

  return createMiddleware<T>(async (ctx, next) => {
    if (condition(ctx)) {
      await trueMw.invoke(ctx, next);
    } else if (falseMw) {
      await falseMw.invoke(ctx, next);
    } else {
      await next();
    }
  });
}

/**
 * Create a middleware that runs only for specific HTTP methods.
 * 
 * @template T - Context data type
 * @param methods - Array of HTTP methods (case-insensitive)
 * @param middleware - Middleware to run for these methods
 * @returns Method-filtered middleware
 * 
 * @remarks
 * **Common Use Cases:**
 * 
 * - CSRF protection: Only for POST, PUT, DELETE
 * - Body parsing: Only for POST, PUT, PATCH
 * - Caching: Only for GET, HEAD
 * - File uploads: Only for POST, PUT
 * 
 * **Case Insensitive:**
 * 
 * Method matching is case-insensitive:
 * 
 * ```typescript
 * forMethods(['post'], middleware)  // Matches POST, Post, post, etc.
 * forMethods(['POST'], middleware)  // Same behavior
 * ```
 * 
 * **Performance:**
 * 
 * - Converts methods to uppercase once at creation
 * - O(n) lookup where n is number of methods (usually tiny: 1-3)
 * - For many methods, consider using a Set internally (optimization)
 * 
 * @example CSRF protection for mutation methods
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(new CorsMiddleware())
 *   .use(forMethods(
 *     ['POST', 'PUT', 'DELETE', 'PATCH'],
 *     new CSRFMiddleware()
 *   ))
 *   .compose();
 * ```
 * 
 * @example Body parsing only for methods with bodies
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forMethods(
 *     ['POST', 'PUT', 'PATCH'],
 *     new JsonBodyParserMiddleware()
 *   ))
 *   .compose();
 * ```
 * 
 * @example GET-only caching
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forMethods(
 *     ['GET', 'HEAD'],
 *     new CacheMiddleware({ ttl: 300 })
 *   ))
 *   .compose();
 * ```
 */
export function forMethods<T extends StruktosContextData = StruktosContextData>(
  methods: string[],
  middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>
): IStruktosMiddleware<T> {
  const upperMethods = methods.map((m) => m.toUpperCase());
  const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;

  return createMiddleware<T>(async (ctx, next) => {
    if (upperMethods.includes(ctx.request.method.toUpperCase())) {
      await mw.invoke(ctx, next);
    } else {
      await next();
    }
  });
}

/**
 * Create a middleware that runs only for specific paths.
 * 
 * @template T - Context data type
 * @param paths - Array of path strings or RegExp pattern
 * @param middleware - Middleware to run for these paths
 * @returns Path-filtered middleware
 * 
 * @remarks
 * **Two Matching Modes:**
 * 
 * 1. **String Array** - Prefix matching:
 * 
 * ```typescript
 * forPaths(['/api/', '/admin/'], middleware)
 * // Matches: /api/users, /admin/dashboard, etc.
 * // Uses: path.startsWith()
 * ```
 * 
 * 2. **RegExp** - Pattern matching:
 * 
 * ```typescript
 * forPaths(/^\/api\/(users|orders)/, middleware)
 * // Matches: /api/users, /api/orders
 * // Does not match: /api/products
 * // Uses: regex.test()
 * ```
 * 
 * **String Matching Details:**
 * 
 * - Uses `startsWith()` - prefix matching only
 * - Case-sensitive
 * - No wildcard support
 * 
 * For advanced patterns, use RegExp instead.
 * 
 * **Performance:**
 * 
 * - String array: O(n) where n is number of paths
 * - RegExp: O(1) but with regex overhead
 * 
 * For many paths, RegExp is usually faster.
 * 
 * @example API-only middleware
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forPaths(
 *     ['/api/'],
 *     new ApiKeyMiddleware()
 *   ))
 *   .compose();
 * ```
 * 
 * @example Admin section protection
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forPaths(
 *     ['/admin/', '/dashboard/'],
 *     compose(
 *       new AdminAuthMiddleware(),
 *       new AdminLoggingMiddleware()
 *     )
 *   ))
 *   .compose();
 * ```
 * 
 * @example RegExp pattern for specific resources
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forPaths(
 *     /^\/(users|orders|products)\/[0-9]+$/,
 *     new ResourceValidationMiddleware()
 *   ))
 *   .compose();
 * ```
 * 
 * @example Excluding paths
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(forPaths(
 *     /^\/(?!health|metrics)/,  // All paths EXCEPT /health and /metrics
 *     new RateLimitMiddleware()
 * ))
 *   .compose();
 * ```
 */
export function forPaths<T extends StruktosContextData = StruktosContextData>(
  paths: string[] | RegExp,
  middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>
): IStruktosMiddleware<T> {
  const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;

  return createMiddleware<T>(async (ctx, next) => {
    const matches = Array.isArray(paths)
      ? paths.some((p) => ctx.request.path.startsWith(p))
      : paths.test(ctx.request.path);

    if (matches) {
      await mw.invoke(ctx, next);
    } else {
      await next();
    }
  });
}

/**
 * Create a middleware that wraps errors from downstream middlewares.
 * 
 * @template T - Context data type
 * @param handler - Error handler function
 * @returns Error-wrapping middleware
 * 
 * @remarks
 * **Error Boundary Pattern:**
 * 
 * This creates an error boundary that catches exceptions from
 * all downstream middlewares:
 * 
 * ```typescript
 * wrapErrors(async (error, ctx) => {
 *   // Handle error
 * })
 * 
 * // Catches errors from:
 * //   - All middlewares after this one
 * //   - The final handler
 * ```
 * 
 * **Handler Responsibilities:**
 * 
 * Your error handler should:
 * 1. Log the error
 * 2. Set response status/body
 * 3. Perform cleanup if needed
 * 4. Re-throw if you want it to propagate further
 * 
 * **Order Matters:**
 * 
 * Place early in the pipeline to catch more errors:
 * 
 * ```typescript
 * createPipeline()
 *   .use(wrapErrors(handler))  // ✅ Catches errors from all below
 *   .use(new AuthMiddleware())
 *   .use(new ValidationMiddleware())
 * ```
 * 
 * **Multiple Error Handlers:**
 * 
 * You can have multiple error handlers at different levels:
 * 
 * ```typescript
 * createPipeline()
 *   .use(wrapErrors(globalErrorHandler))  // Outermost
 *   .use(authMiddlewares)
 *   .use(wrapErrors(apiErrorHandler))  // Inner
 *   .use(apiMiddlewares)
 * ```
 * 
 * @example HTTP error handling
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(wrapErrors(async (error, ctx) => {
 *     console.error('Request failed:', error);
 *     
 *     if (error instanceof ValidationError) {
 *       ctx.response.status = 400;
 *       ctx.response.body = { error: error.message };
 *     } else if (error instanceof UnauthorizedError) {
 *       ctx.response.status = 401;
 *       ctx.response.body = { error: 'Unauthorized' };
 *     } else {
 *       ctx.response.status = 500;
 *       ctx.response.body = { error: 'Internal Server Error' };
 *     }
 *   }))
 *   .use(new AuthMiddleware())
 *   .use(new ValidationMiddleware())
 *   .compose();
 * ```
 * 
 * @example Error logging with context
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(wrapErrors(async (error, ctx) => {
 *     logger.error('Pipeline error', {
 *       error: error.message,
 *       stack: error.stack,
 *       traceId: ctx.context.get('traceId'),
 *       userId: ctx.context.get('userId'),
 *       path: ctx.request.path,
 *       method: ctx.request.method,
 *     });
 *     
 *     // Re-throw to propagate to outer error handler
 *     throw error;
 *   }))
 *   .compose();
 * ```
 */
export function wrapErrors<T extends StruktosContextData = StruktosContextData>(
  handler: (error: Error, ctx: MiddlewareContext<T>) => Promise<void> | void
): IStruktosMiddleware<T> {
  return createMiddleware<T>(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      await handler(error as Error, ctx);
    }
  });
}

/**
 * Create a middleware that runs middlewares in parallel.
 * 
 * @template T - Context data type
 * @param middlewares - Middlewares to run in parallel
 * @returns Parallel-executing middleware
 * 
 * @remarks
 * **⚠️ WARNING: Response Modifications May Conflict!**
 * 
 * Running middlewares in parallel is dangerous if they modify
 * the response. Consider this:
 * 
 * ```typescript
 * parallel(
 *   async (ctx, next) => { ctx.response.status = 200; await next(); },
 *   async (ctx, next) => { ctx.response.status = 404; await next(); }
 * )
 * // Final status: 200? 404? Race condition!
 * ```
 * 
 * **Safe Use Cases:**
 * 
 * Parallel execution is safe for:
 * - ✅ Read-only operations (logging, metrics)
 * - ✅ Independent side effects (sending emails, updating cache)
 * - ✅ Data fetching that doesn't modify context
 * 
 * **Unsafe Use Cases:**
 * 
 * Avoid for:
 * - ❌ Response modification (status, headers, body)
 * - ❌ Context mutation (unless using locks)
 * - ❌ Order-dependent operations
 * 
 * **Execution Model:**
 * 
 * ```typescript
 * await Promise.all([
 *   mw1.invoke(ctx, () => {}),  // Note: next() is a no-op
 *   mw2.invoke(ctx, () => {}),
 *   mw3.invoke(ctx, () => {})
 * ]);
 * await next();  // Called once after all complete
 * ```
 * 
 * Each middleware gets a no-op `next()` function because there's
 * no meaningful "next middleware" in parallel execution.
 * 
 * **Error Handling:**
 * 
 * @example If ANY middleware throws, the entire parallel block fails:
 * ```typescript
 * parallel(
 *    async () => { succeeds },
 *    async () => { throw new Error('Oops'); },
 *    async () => { succeeds }
 * )
 * // All three start, but the error causes Promise.all to reject
 * 
 * @example Parallel logging and metrics
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(parallel(
 *     async (ctx) => {
 *       await logRequest(ctx.request);
 *     },
 *     async (ctx) => {
 *       await recordMetric('requests', 1);
 *     },
 *     async (ctx) => {
 *       await updateUserActivity(ctx.context.get('userId'));
 *     }
 *   ))
 *   .compose();
 * ```
 * 
 * @example Parallel data fetching (READ-ONLY)
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(parallel(
 *     async (ctx) => {
 *       const user = await fetchUser(ctx.context.get('userId'));
 *       ctx.items.set('user', user);  // ⚠️ Careful with mutations!
 *     },
 *     async (ctx) => {
 *       const settings = await fetchSettings();
 *       ctx.items.set('settings', settings);
 *     }
 *   ))
 *   .compose();
 * ```
 * 
 * @example ❌ INCORRECT: Parallel response modification
 * ```typescript
 * // ❌ DON'T DO THIS - Race condition!
 * const badPipeline = createPipeline()
 *   .use(parallel(
 *     async (ctx) => { ctx.response.setHeader('X-A', 'value1'); },
 *     async (ctx) => { ctx.response.setHeader('X-B', 'value2'); }
 *   ))
 *   .compose();
 * ```
 */
export function parallel<T extends StruktosContextData = StruktosContextData>(
  ...middlewares: Array<IStruktosMiddleware<T> | MiddlewareFunction<T>>
): IStruktosMiddleware<T> {
  const mws = middlewares.map((m) => (typeof m === 'function' ? createMiddleware(m) : m));

  return createMiddleware<T>(async (ctx, next) => {
    await Promise.all(mws.map((mw) => mw.invoke(ctx, async () => {})));
    await next();
  });
}

/**
 * Create a middleware with retry logic.
 * 
 * @template T - Context data type
 * @param middleware - Middleware to wrap with retry
 * @param options - Retry configuration
 * @returns Retry-wrapped middleware
 * 
 * @remarks
 * **Retry Pattern:**
 * 
 * Automatically retries failed operations:
 * 
 * ```
 * Attempt 1: Fail → Wait 1000ms → Attempt 2: Fail → Wait 1000ms → Attempt 3: Success
 * ```
 * 
 * **Options:**
 * 
 * - `maxRetries`: Maximum retry attempts (default: 3)
 * - `retryDelay`: Delay between retries in ms (default: 1000)
 * - `shouldRetry`: Function to decide if error should be retried (default: retry all)
 * 
 * **Retry Decision:**
 * 
 * The `shouldRetry` function receives the error and returns boolean:
 * 
 * ```typescript
 * shouldRetry: (error) => {
 *   // Retry network errors
 *   if (error.code === 'ECONNREFUSED') return true;
 *   
 *   // Don't retry validation errors
 *   if (error instanceof ValidationError) return false;
 *   
 *   // Retry 5xx, but not 4xx
 *   if (error.statusCode >= 500) return true;
 *   
 *   return false;
 * }
 * ```
 * 
 * **Backoff Strategy:**
 * 
 * Current implementation uses **fixed delay**. For production,
 * consider exponential backoff:
 * 
 * ```typescript
 * // Exponential backoff (custom implementation needed)
 * delay = retryDelay * Math.pow(2, attemptNumber)
 * // Attempt 1: 1000ms
 * // Attempt 2: 2000ms
 * // Attempt 3: 4000ms
 * ```
 * 
 * **Idempotency Warning:**
 * 
 * Only retry **idempotent** operations:
 * - ✅ Safe: GET requests, database reads, pure computations
 * - ❌ Unsafe: POST requests, payments, database writes
 * 
 * Retrying non-idempotent operations can cause duplicates:
 * 
 * ```typescript
 * // ❌ BAD: Retrying payment could charge twice
 * withRetry(
 *   async () => await processPayment(orderId, amount),
 *   { maxRetries: 3 }
 * )
 * ```
 * 
 * @example Network request with retry
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(withRetry(
 *     async (ctx, next) => {
 *       const data = await fetch('https://api.example.com/data');
 *       ctx.items.set('apiData', data);
 *       await next();
 *     },
 *     {
 *       maxRetries: 3,
 *       retryDelay: 2000,
 *       shouldRetry: (error) => {
 *         // Only retry network errors
 *         return error.code === 'ECONNREFUSED' ||
 *                error.code === 'ETIMEDOUT';
 *       }
 *     }
 *   ))
 *   .compose();
 * ```
 * 
 * @example Database query with retry
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(withRetry(
 *     async (ctx, next) => {
 *       const user = await db.users.findById(ctx.context.get('userId'));
 *       ctx.items.set('user', user);
 *       await next();
 *     },
 *     {
 *       maxRetries: 2,
 *       retryDelay: 500,
 *       shouldRetry: (error) => {
 *         // Retry on connection errors, not on "not found"
 *         return error.code === 'CONNECTION_LOST';
 *       }
 *     }
 *   ))
 *   .compose();
 * ```
 */
export function withRetry<T extends StruktosContextData = StruktosContextData>(
  middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): IStruktosMiddleware<T> {
  const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;
  const { maxRetries = 3, retryDelay = 1000, shouldRetry = () => true } = options;

  return createMiddleware<T>(async (ctx, next) => {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts <= maxRetries) {
      try {
        await mw.invoke(ctx, next);
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts > maxRetries || !shouldRetry(lastError)) {
          throw lastError;
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (lastError) {
      throw lastError;
    }
  });
}

/**
 * Create a middleware with timeout.
 * 
 * @template T - Context data type
 * @param middleware - Middleware to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @returns Timeout-wrapped middleware
 * 
 * @remarks
 * **Timeout Pattern:**
 * 
 * Automatically fails if middleware takes too long:
 * 
 * ```
 * Start → Wait up to timeoutMs → Throw TimeoutError
 * ```
 * 
 * **Important: Timeout ≠ Cancellation**
 * 
 * This timeout throws an error but does NOT cancel the middleware:
 * 
 * ```typescript
 * withTimeout(
 *   async () => {
 *     await longOperation();  // Still runs even after timeout!
 *   },
 *   1000
 * )
 * ```
 * 
 * The middleware continues running in the background. To actually
 * cancel, use context cancellation:
 * 
 * ```typescript
 * withTimeout(
 *   async (ctx) => {
 *     const abortController = new AbortController();
 *     ctx.context.onCancel(() => abortController.abort());
 *     
 *     await fetch(url, { signal: abortController.signal });
 *   },
 *   5000
 * )
 * ```
 * 
 * **Use Cases:**
 * 
 * - External API calls
 * - Database queries
 * - Long-running computations
 * - User-initiated operations
 * 
 * **Timeout Selection:**
 * 
 * Choose timeout based on operation type:
 * - **Fast operations**: 100-500ms (cache, memory access)
 * - **Network operations**: 1000-5000ms (API calls)
 * - **Database operations**: 3000-10000ms (complex queries)
 * - **Heavy computation**: 10000-30000ms (data processing)
 * 
 * **Error Message:**
 * 
 * Timeout throws an Error with a descriptive message:
 * 
 * ```
 * Error: Middleware timeout after 5000ms
 * ```
 * 
 * Consider catching and converting to your own error type:
 * 
 * ```typescript
 * wrapErrors((error, ctx) => {
 *   if (error.message.includes('timeout')) {
 *     throw new TimeoutError('Operation timed out', { cause: error });
 *   }
 *   throw error;
 * })
 * ```
 * 
 * @example API call with timeout
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(withTimeout(
 *     async (ctx, next) => {
 *       const data = await fetch('https://api.example.com/data');
 *       ctx.items.set('apiData', data);
 *       await next();
 *     },
 *     5000  // 5 second timeout
 *   ))
 *   .compose();
 * ```
 * 
 * @example Database query with timeout
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(withTimeout(
 *     async (ctx, next) => {
 *       const results = await db.complexQuery();
 *       ctx.items.set('results', results);
 *       await next();
 *     },
 *     10000  // 10 second timeout
 *   ))
 *   .compose();
 * ```
 * 
 * @example Combined with retry
 * ```typescript
 * const pipeline = createPipeline()
 *   .use(withRetry(
 *     withTimeout(
 *       async (ctx, next) => {
 *         await externalApiCall();
 *         await next();
 *       },
 *       3000  // 3 second timeout per attempt
 *     ),
 *     { maxRetries: 3 }  // Retry on timeout
 *   ))
 *   .compose();
 * ```
 */
export function withTimeout<T extends StruktosContextData = StruktosContextData>(
  middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>,
  timeoutMs: number
): IStruktosMiddleware<T> {
  const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;

  return createMiddleware<T>(async (ctx, next) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Middleware timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([mw.invoke(ctx, next), timeoutPromise]);
  });
}