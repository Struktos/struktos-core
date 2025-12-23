/**
 * @struktos/core - Exception Filter Interface
 *
 * ASP.NET Core / NestJS-inspired exception handling for Struktos platform.
 * Provides a structured way to handle and transform exceptions into responses.
 */

import { RequestContext, StruktosContextData } from '../context';
import {
  StruktosResponse,
  HttpStatus,
  createErrorResponse,
} from '../../infrastructure/platform/types';

/**
 * Exception context containing error and request information
 */
export interface ExceptionContext<
  T extends StruktosContextData = StruktosContextData,
> {
  /** The caught exception */
  error: Error;

  /** Request context */
  context: RequestContext<T>;

  /** Request path */
  path: string;

  /** HTTP method */
  method: string;

  /** Timestamp when exception occurred */
  timestamp: Date;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * IExceptionFilter - Exception handling interface
 *
 * Implements the catch method to transform exceptions into responses.
 * Multiple filters can be registered to handle different exception types.
 *
 * @example
 * ```typescript
 * class ValidationExceptionFilter implements IExceptionFilter {
 *   async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
 *     if (ctx.error instanceof ValidationError) {
 *       return {
 *         status: 400,
 *         headers: { 'Content-Type': 'application/json' },
 *         body: {
 *           error: 'Validation Error',
 *           message: ctx.error.message,
 *           details: ctx.error.details
 *         }
 *       };
 *     }
 *     throw ctx.error; // Re-throw if not handled
 *   }
 * }
 * ```
 */
export interface IExceptionFilter<
  T extends StruktosContextData = StruktosContextData,
> {
  /**
   * Handle an exception and return a response
   *
   * @param ctx - Exception context
   * @returns Response to send to client, or throws to pass to next filter
   */
  catch(ctx: ExceptionContext<T>): Promise<StruktosResponse>;
}

/**
 * Exception filter function type
 */
export type ExceptionFilterFunction<
  T extends StruktosContextData = StruktosContextData,
> = (ctx: ExceptionContext<T>) => Promise<StruktosResponse>;

/**
 * Create an exception filter from a function
 */
export function createExceptionFilter<
  T extends StruktosContextData = StruktosContextData,
>(fn: ExceptionFilterFunction<T>): IExceptionFilter<T> {
  return { catch: fn };
}

// ==================== Built-in Exceptions ====================

/**
 * Base HTTP exception class
 */
export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'HttpException';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request', details?: any) {
    super(HttpStatus.BAD_REQUEST, message, details);
    this.name = 'BadRequestException';
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(HttpStatus.UNAUTHORIZED, message, details);
    this.name = 'UnauthorizedException';
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden', details?: any) {
    super(HttpStatus.FORBIDDEN, message, details);
    this.name = 'ForbiddenException';
  }
}

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
  constructor(message: string = 'Not Found', details?: any) {
    super(HttpStatus.NOT_FOUND, message, details);
    this.name = 'NotFoundException';
  }
}

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict', details?: any) {
    super(HttpStatus.CONFLICT, message, details);
    this.name = 'ConflictException';
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export class ValidationException extends HttpException {
  constructor(
    message: string = 'Validation Failed',
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, errors);
    this.name = 'ValidationException';
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsException extends HttpException {
  constructor(
    message: string = 'Too Many Requests',
    public readonly retryAfter?: number,
  ) {
    super(HttpStatus.TOO_MANY_REQUESTS, message, { retryAfter });
    this.name = 'TooManyRequestsException';
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerException extends HttpException {
  constructor(message: string = 'Internal Server Error', details?: any) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message, details);
    this.name = 'InternalServerException';
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableException extends HttpException {
  constructor(message: string = 'Service Unavailable', details?: any) {
    super(HttpStatus.SERVICE_UNAVAILABLE, message, details);
    this.name = 'ServiceUnavailableException';
  }
}

// ==================== Built-in Exception Filters ====================

/**
 * Default exception filter - handles all exceptions
 */
export class DefaultExceptionFilter implements IExceptionFilter {
  constructor(
    private readonly options: {
      includeStack?: boolean;
      includeDetails?: boolean;
      logErrors?: boolean;
    } = {},
  ) {
    this.options = {
      includeStack: process.env.NODE_ENV !== 'production',
      includeDetails: process.env.NODE_ENV !== 'production',
      logErrors: true,
      ...options,
    };
  }

  async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
    const { error, context, path, method, timestamp } = ctx;
    const traceId = context.get('traceId');

    if (this.options.logErrors) {
      console.error(`[${traceId}] Exception in ${method} ${path}:`, error);
    }

    // Handle HTTP exceptions
    if (error instanceof HttpException) {
      return {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: error.name
            .replace('Exception', '')
            .replace(/([A-Z])/g, ' $1')
            .trim(),
          message: error.message,
          statusCode: error.statusCode,
          traceId,
          timestamp: timestamp.toISOString(),
          path,
          ...(this.options.includeDetails &&
            error.details && { details: error.details }),
          ...(this.options.includeStack && { stack: error.stack }),
        },
      };
    }

    // Handle generic errors
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Internal Server Error',
        message: this.options.includeDetails
          ? error.message
          : 'An unexpected error occurred',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        traceId,
        timestamp: timestamp.toISOString(),
        path,
        ...(this.options.includeStack && { stack: error.stack }),
      },
    };
  }
}

/**
 * HTTP exception filter - only handles HttpException instances
 */
export class HttpExceptionFilter implements IExceptionFilter {
  async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
    const { error, context, path, timestamp } = ctx;

    if (!(error instanceof HttpException)) {
      throw error; // Pass to next filter
    }

    const traceId = context.get('traceId');

    return {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: error.name.replace('Exception', ''),
        message: error.message,
        statusCode: error.statusCode,
        traceId,
        timestamp: timestamp.toISOString(),
        path,
        ...(error.details && { details: error.details }),
      },
    };
  }
}

/**
 * Validation exception filter - handles ValidationException
 */
export class ValidationExceptionFilter implements IExceptionFilter {
  async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
    const { error, context, path, timestamp } = ctx;

    if (!(error instanceof ValidationException)) {
      throw error; // Pass to next filter
    }

    const traceId = context.get('traceId');

    return {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Validation Error',
        message: error.message,
        statusCode: error.statusCode,
        errors: error.errors,
        traceId,
        timestamp: timestamp.toISOString(),
        path,
      },
    };
  }
}

/**
 * Exception filter chain - runs filters in order
 */
export class ExceptionFilterChain implements IExceptionFilter {
  private filters: IExceptionFilter[] = [];

  /**
   * Add a filter to the chain
   */
  addFilter(filter: IExceptionFilter): this {
    this.filters.push(filter);
    return this;
  }

  /**
   * Add multiple filters
   */
  addFilters(filters: IExceptionFilter[]): this {
    this.filters.push(...filters);
    return this;
  }

  async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
    let lastError: Error = ctx.error;

    for (const filter of this.filters) {
      try {
        return await filter.catch({ ...ctx, error: lastError });
      } catch (error) {
        lastError = error as Error;
      }
    }

    // If no filter handled it, use default response
    return createErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
      lastError.message,
    );
  }
}
