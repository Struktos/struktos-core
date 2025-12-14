/**
 * @struktos/core - Platform Module
 * 
 * Platform abstractions for middleware, request/response
 */

// Types
export {
  HttpStatus,
  ProtocolType,
  StruktosRequest,
  StruktosResponse,
  ResponseBuilder,
  ErrorResponse,
  response,
  createErrorResponse,
} from './types';

// Middleware
export {
  IStruktosMiddleware,
  MiddlewareFunction,
  MiddlewareContext,
  NextFunction,
  MiddlewareFactory,
  IServiceProvider,
  isMiddleware,
  createMiddleware,
  StruktosMiddlewareBase,
  LoggingMiddleware,
  TimingMiddleware,
  ErrorHandlingMiddleware,
  CorsMiddleware,
} from './middleware';