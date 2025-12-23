/**
 * @struktos/core - Platform Module
 *
 * Platform abstractions for middleware, request/response
 */

// Types
export {
  HttpStatus,
  ResponseBuilder,
  response,
  createErrorResponse,
} from './types';

export type {
  ProtocolType,
  StruktosRequest,
  StruktosResponse,
  ErrorResponse,
} from './types';

// Middleware
export {
  isMiddleware,
  createMiddleware,
  StruktosMiddlewareBase,
  LoggingMiddleware,
  TimingMiddleware,
  ErrorHandlingMiddleware,
  CorsMiddleware,
} from './middleware';

export type {
  IStruktosMiddleware,
  MiddlewareFunction,
  MiddlewareContext,
  NextFunction,
  MiddlewareFactory,
  IServiceProvider,
} from './middleware';
