/**
 * @struktos/core v1.0.0
 * 
 * Enterprise-grade Node.js platform with ASP.NET Core-inspired architecture,
 * Go-style context propagation, and high-performance infrastructure.
 * 
 * @example
 * ```typescript
 * import { 
 *   StruktosApp, 
 *   RequestContext, 
 *   createMiddleware,
 *   HttpException 
 * } from '@struktos/core';
 * 
 * const app = StruktosApp.create();
 * 
 * // Add middleware
 * app.use(async (ctx, next) => {
 *   console.log(`${ctx.request.method} ${ctx.request.path}`);
 *   await next();
 * });
 * 
 * // Start with adapter
 * await app.listen(expressAdapter, 3000);
 * ```
 * 
 * @module @struktos/core
 */

// ==================== Core Context System ====================
export { 
  IContext, 
  StruktosContextData, 
  StruktosContext 
} from './core';

export { 
  RequestContext, 
  getCurrentContext, 
  tryGetCurrentContext,
  RequireContext 
} from './core';

// ==================== Cache Management ====================
export { 
  CacheManager, 
  CacheStats,
  globalCache, 
  createCacheManager 
} from './cache';

// ==================== Platform Abstractions ====================

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
} from './platform';

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
} from './platform';

// Exception Handling
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
} from './platform';

// ==================== Hosting ====================

// Adapters
export {
  IAdapter,
  IHttpAdapter,
  IGrpcAdapter,
  IMessageQueueAdapter,
  IWebSocketAdapter,
  AdapterBase,
  AdapterOptions,
  AdapterLifecycle,
  AdapterFactory,
  ServerInfo,
} from './hosting';

// Host
export {
  IHost,
  IBackgroundService,
  ILogger,
  HostOptions,
  HostLifecycle,
  HostStatus,
  StruktosHost,
  BackgroundServiceBase,
  IntervalService,
  consoleLogger,
  createHost,
} from './hosting';

// Application
export {
  StruktosApp,
  StruktosAppOptions,
  StruktosAppBuilder,
  createApp,
  createAppBuilder,
} from './hosting';

// ==================== Pipeline ====================
export {
  PipelineBuilder,
  createPipeline,
  compose,
  branch,
  forMethods,
  forPaths,
  wrapErrors,
  parallel,
  withRetry,
  withTimeout,
} from './pipeline';

// ==================== Version ====================
export const VERSION = '1.0.0';

// ==================== Default Export ====================
export { StruktosApp as default } from './hosting';