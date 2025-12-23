/**
 * @struktos/core - Exception Module
 *
 * Exception abstractions for exception handling
 */

// Exceptions
export {
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

export type {
  IExceptionFilter,
  ExceptionFilterFunction,
  ExceptionContext,
} from './exceptions';
