/**
 * @struktos/core - Exception Module
 * 
 * Exception abstractions for exception handling
 */

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