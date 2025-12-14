/**
 * @struktos/core - Middleware Interface
 * 
 * ASP.NET Core-inspired middleware interface for Struktos platform.
 * Provides a unified middleware abstraction that works across different adapters.
 */

import { RequestContext, StruktosContextData } from '../../domain/context';
import { StruktosRequest, StruktosResponse } from './types';

/**
 * Next function type for middleware chain
 */
export type NextFunction = () => Promise<void>;

/**
 * Middleware context containing request, response, and context data
 */
export interface MiddlewareContext<T extends StruktosContextData = StruktosContextData> {
  /** Request context from AsyncLocalStorage */
  context: RequestContext<T>;

  /** Abstract request object */
  request: StruktosRequest;

  /** Abstract response object (mutable) */
  response: StruktosResponse;

  /** Items bag for passing data between middlewares */
  items: Map<string, any>;

  /** Request services (DI container access) */
  services?: IServiceProvider;
}

/**
 * Service provider interface for dependency injection
 */
export interface IServiceProvider {
  /**
   * Get a service by type/token
   */
  get<T>(token: string | symbol | (new (...args: any[]) => T)): T | undefined;

  /**
   * Get a required service (throws if not found)
   */
  getRequired<T>(token: string | symbol | (new (...args: any[]) => T)): T;

  /**
   * Check if a service is registered
   */
  has(token: string | symbol | (new (...args: any[]) => any)): boolean;
}

/**
 * IStruktosMiddleware - Core middleware interface
 * 
 * Inspired by ASP.NET Core's middleware pattern. Each middleware receives
 * a context and a next function to call the next middleware in the pipeline.
 * 
 * @example
 * ```typescript
 * class LoggingMiddleware implements IStruktosMiddleware {
 *   async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
 *     const start = Date.now();
 *     console.log(`[${ctx.request.method}] ${ctx.request.path}`);
 *     
 *     await next(); // Call next middleware
 *     
 *     const duration = Date.now() - start;
 *     console.log(`Completed in ${duration}ms`);
 *   }
 * }
 * ```
 */
export interface IStruktosMiddleware<T extends StruktosContextData = StruktosContextData> {
  /**
   * Middleware execution method
   * 
   * @param ctx - Middleware context containing request, response, and context
   * @param next - Function to invoke the next middleware in the pipeline
   */
  invoke(ctx: MiddlewareContext<T>, next: NextFunction): Promise<void>;
}

/**
 * Middleware function type for inline middleware
 */
export type MiddlewareFunction<T extends StruktosContextData = StruktosContextData> = (
  ctx: MiddlewareContext<T>,
  next: NextFunction
) => Promise<void>;

/**
 * Type guard to check if something is a middleware
 */
export function isMiddleware(obj: any): obj is IStruktosMiddleware {
  return obj && typeof obj.invoke === 'function';
}

/**
 * Convert a function to middleware object
 */
export function createMiddleware<T extends StruktosContextData = StruktosContextData>(
  fn: MiddlewareFunction<T>
): IStruktosMiddleware<T> {
  return {
    invoke: fn,
  };
}

/**
 * Middleware factory type for configurable middleware
 */
export type MiddlewareFactory<TOptions = any, T extends StruktosContextData = StruktosContextData> = (
  options?: TOptions
) => IStruktosMiddleware<T>;

/**
 * Abstract base class for middleware with common utilities
 */
export abstract class StruktosMiddlewareBase<T extends StruktosContextData = StruktosContextData>
  implements IStruktosMiddleware<T>
{
  /**
   * Implement this method in derived classes
   */
  abstract invoke(ctx: MiddlewareContext<T>, next: NextFunction): Promise<void>;

  /**
   * Helper to get trace ID from context
   */
  protected getTraceId(ctx: MiddlewareContext<T>): string | undefined {
    return ctx.context.get('traceId' as keyof T) as string | undefined;
  }

  /**
   * Helper to get user ID from context
   */
  protected getUserId(ctx: MiddlewareContext<T>): string | undefined {
    return ctx.context.get('userId' as keyof T) as string | undefined;
  }

  /**
   * Helper to set response status and body
   */
  protected setResponse(ctx: MiddlewareContext<T>, status: number, body?: any): void {
    ctx.response.status = status;
    ctx.response.body = body;
  }

  /**
   * Helper to check if context is cancelled
   */
  protected isCancelled(ctx: MiddlewareContext<T>): boolean {
    return ctx.context.isCancelled();
  }
}

// ==================== Built-in Middlewares ====================

/**
 * Logging middleware - logs request/response lifecycle
 */
export class LoggingMiddleware extends StruktosMiddlewareBase {
  constructor(
    private readonly options: {
      logRequest?: boolean;
      logResponse?: boolean;
      logDuration?: boolean;
    } = {}
  ) {
    super();
    this.options = {
      logRequest: true,
      logResponse: true,
      logDuration: true,
      ...options,
    };
  }

  async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
    const start = Date.now();
    const traceId = this.getTraceId(ctx);

    if (this.options.logRequest) {
      console.log(`[${traceId}] → ${ctx.request.method} ${ctx.request.path}`);
    }

    await next();

    const duration = Date.now() - start;

    if (this.options.logResponse) {
      console.log(
        `[${traceId}] ← ${ctx.response.status}${this.options.logDuration ? ` (${duration}ms)` : ''}`
      );
    }
  }
}

/**
 * Timing middleware - adds timing header to response
 */
export class TimingMiddleware extends StruktosMiddlewareBase {
  constructor(private readonly headerName: string = 'X-Response-Time') {
    super();
  }

  async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    ctx.response.headers[this.headerName] = `${duration}ms`;
  }
}

/**
 * Error handling middleware - catches errors and formats response
 */
export class ErrorHandlingMiddleware extends StruktosMiddlewareBase {
  constructor(
    private readonly options: {
      includeStack?: boolean;
      includeDetails?: boolean;
    } = {}
  ) {
    super();
  }

  async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
    try {
      await next();
    } catch (error) {
      const traceId = this.getTraceId(ctx);
      
      ctx.response.status = (error as any).statusCode || 500;
      ctx.response.headers['Content-Type'] = 'application/json';
      ctx.response.body = {
        error: (error as Error).name || 'Error',
        message: (error as Error).message || 'An unexpected error occurred',
        statusCode: ctx.response.status,
        traceId,
        timestamp: new Date().toISOString(),
        path: ctx.request.path,
        ...(this.options.includeStack && { stack: (error as Error).stack }),
        ...(this.options.includeDetails && { details: (error as any).details }),
      };
    }
  }
}

/**
 * CORS middleware - handles Cross-Origin Resource Sharing
 */
export class CorsMiddleware extends StruktosMiddlewareBase {
  constructor(
    private readonly options: {
      origin?: string | string[] | ((origin: string) => boolean);
      methods?: string[];
      headers?: string[];
      credentials?: boolean;
      maxAge?: number;
    } = {}
  ) {
    super();
    this.options = {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
      maxAge: 86400,
      ...options,
    };
  }

  async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
    const origin = ctx.request.headers['origin'] as string;

    // Set CORS headers
    const allowedOrigin = this.getAllowedOrigin(origin);
    if (allowedOrigin) {
      ctx.response.headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }

    if (this.options.credentials) {
      ctx.response.headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Handle preflight
    if (ctx.request.method === 'OPTIONS') {
      ctx.response.headers['Access-Control-Allow-Methods'] = this.options.methods!.join(', ');
      ctx.response.headers['Access-Control-Allow-Headers'] = this.options.headers!.join(', ');
      ctx.response.headers['Access-Control-Max-Age'] = String(this.options.maxAge);
      ctx.response.status = 204;
      return;
    }

    await next();
  }

  private getAllowedOrigin(origin: string): string | null {
    if (this.options.origin === '*') return '*';
    if (typeof this.options.origin === 'string') {
      return this.options.origin === origin ? origin : null;
    }
    if (Array.isArray(this.options.origin)) {
      return this.options.origin.includes(origin) ? origin : null;
    }
    if (typeof this.options.origin === 'function') {
      return this.options.origin(origin) ? origin : null;
    }
    return null;
  }
}