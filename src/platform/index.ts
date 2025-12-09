/**
 * @struktos/core - Platform Module
 * 
 * Platform abstractions for middleware, exception handling, and request/response
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

// Exceptions
export {
  IExceptionFilter,
  ExceptionFilterFunction,
  ExceptionContext,
  createExceptionFilter,
  // Built-in exceptions
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ValidationException,
  TooManyRequestsException,
  InternalServerException,
  ServiceUnavailableException,
  // Built-in filters
  DefaultExceptionFilter,
  HttpExceptionFilter,
  ValidationExceptionFilter,
  ExceptionFilterChain,
} from './exceptions';