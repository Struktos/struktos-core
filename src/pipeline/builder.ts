/**
 * @struktos/core - Pipeline Utilities
 * 
 * Utilities for building and managing middleware pipelines.
 */

import { StruktosContextData } from '../core';
import { 
  IStruktosMiddleware, 
  MiddlewareFunction, 
  createMiddleware,
  MiddlewareContext,
  NextFunction 
} from '../platform/middleware';

/**
 * Pipeline builder for composing middlewares
 */
export class PipelineBuilder<T extends StruktosContextData = StruktosContextData> {
  private middlewares: IStruktosMiddleware<T>[] = [];

  /**
   * Add middleware to the pipeline
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
   * Add middleware conditionally
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
   * Add middleware at the beginning of the pipeline
   */
  prepend(middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;
    this.middlewares.unshift(mw);
    return this;
  }

  /**
   * Add middleware at a specific position
   */
  insertAt(index: number, middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    const mw = typeof middleware === 'function' ? createMiddleware(middleware) : middleware;
    this.middlewares.splice(index, 0, mw);
    return this;
  }

  /**
   * Build the pipeline as an array
   */
  build(): IStruktosMiddleware<T>[] {
    return [...this.middlewares];
  }

  /**
   * Build and return a single composed middleware
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
   * Get the number of middlewares
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * Clear all middlewares
   */
  clear(): this {
    this.middlewares = [];
    return this;
  }
}

/**
 * Create a new pipeline builder
 */
export function createPipeline<T extends StruktosContextData = StruktosContextData>(): PipelineBuilder<T> {
  return new PipelineBuilder<T>();
}

/**
 * Compose multiple middlewares into a single middleware
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
 * Create a branching middleware that runs different pipelines based on condition
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
 * Create a middleware that runs only for specific HTTP methods
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
 * Create a middleware that runs only for specific paths
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
 * Create a middleware that wraps errors from downstream middlewares
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
 * Create a middleware that runs middlewares in parallel
 * Note: Response modifications may conflict
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
 * Create a middleware with retry logic
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
 * Create a middleware with timeout
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