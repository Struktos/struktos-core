/**
 * @fileoverview @struktos/core - Enterprise Node.js Framework
 * @description
 * Struktos Core provides enterprise-grade abstractions for building
 * scalable, maintainable Node.js applications following Hexagonal
 * Architecture and Domain-Driven Design principles.
 * *
 *
 * ## Architecture Layers
 * ... (TSDoc Description Remains Unchanged) ...
 * * @packageDocumentation
 * @module @struktos/core
 * @version 1.0.0
 */

// ============================================================================
// DOMAIN LAYER EXPORTS (Core Abstractions & Rules)
// ============================================================================

// ** 1. Context System (Domain Core Data Carrier) **
export {
  RequestContext,
  getCurrentContext,
  tryGetCurrentContext,
  RequireContext,
} from './domain/context';

export type {
  IContext,
  StruktosContextData,
  StruktosContext,
} from './domain/context';

// ** 2. Exception Types (Domain/Business Rules Errors) **
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
} from './domain/exceptions';

export type {
  IExceptionFilter,
  ExceptionFilterFunction,
  ExceptionContext,
} from './domain/exceptions';

export type {
  EventMetadata,
  IDomainEvent,
  IEventRaisingEntity,
  IEventBus,
  IEventHandler,
} from './domain/events';
export { AggregateRoot } from './domain/events';

/**
 * Domain layer containing core business rules (Entities, Repositories, UoW, Specifications).
 */
export * from './domain'; // Re-exports from all files in './domain'

// ============================================================================
// APPLICATION LAYER EXPORTS (Orchestration & Host)
// ============================================================================

// ** 1. Hosting / Lifecycle (The Application Runner) **
export {
  StruktosHost,
  BackgroundServiceBase,
  IntervalService,
  consoleLogger,
  createHost,
  StruktosApp,
  StruktosAppBuilder,
  createApp,
  createAppBuilder,
} from './application/host';

export type {
  IHost,
  IBackgroundService,
  ILogger,
  HostOptions,
  HostLifecycle,
  HostStatus,
  StruktosAppOptions,
} from './application/host';

// ** 2. Ports (Contracts for Infrastructure Adapters) **
export { AdapterBase } from './application/ports';
export type {
  IAdapter,
  IHttpAdapter,
  IGrpcAdapter,
  IMessageQueueAdapter,
  IWebSocketAdapter,
  AdapterOptions,
  AdapterLifecycle,
  AdapterFactory,
  ServerInfo,
} from './application/ports';

export type {
  IServiceCollection,
  IDIServiceProvider,
  IServiceScope,
} from './application/di';

export { ServiceScope } from './application/di';
export { Injectable, Inject } from './application/di';
export { DependencyResolutionError } from './application/di';

/**
 * Application layer containing use case orchestration (CQRS, Handlers, Host).
 */
export * from './application'; // Re-exports from all files in './application'

// ============================================================================
// INFRASTRUCTURE LAYER EXPORTS (External Concerns)
// ============================================================================

// ** 1. Middleware / Platform Handling **
export {
  isMiddleware,
  createMiddleware,
  StruktosMiddlewareBase,
  LoggingMiddleware,
  TimingMiddleware,
  ErrorHandlingMiddleware,
  CorsMiddleware,
  ResponseBuilder,
  response,
} from './infrastructure/platform';

export type {
  IStruktosMiddleware,
  MiddlewareFunction,
  MiddlewareContext,
  NextFunction,
  MiddlewareFactory,
  IServiceProvider,
  // Platform specific types
  ProtocolType,
  StruktosRequest,
  StruktosResponse,
} from './infrastructure/platform';

// ** 3. Pipeline **
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
} from './infrastructure/pipeline';

// ** 4. Cache (Specific Infrastructure Adapter) **
export {
  CacheManager,
  globalCache,
  createCacheManager,
} from './infrastructure/cache';

export type { CacheStats } from './infrastructure/cache';

/**
 * Infrastructure layer containing external concerns (Platform, Tracing, Resilience).
 */
export * from './infrastructure'; // Re-exports from all files in './infrastructure'

// ============================================================================
// CONVENIENCE RE-EXPORTS (CQRS, UoW, Resilience, Tracing)
// ============================================================================

// Domain - Unit of Work & Spec
export type {
  IUnitOfWork,
  IUnitOfWorkFactory,
  TransactionOptions,
  TransactionResult,
} from './domain/repository/IUnitOfWork';
export type {
  ISpecification,
  IQueryableSpecification,
} from './domain/specification/ISpecification';

// Application - CQRS
export type {
  ICommand,
  IQuery,
  ICommandHandler,
  IQueryHandler,
  ICommandBus,
  IQueryBus,
  HandlerContext,
  IPipelineBehavior,
} from './application/cqrs';

// Infrastructure - Tracing & Resilience
export type {
  ITracer,
  ISpan,
  TraceContext,
} from './infrastructure/tracing/ITracer';
export type {
  IResiliencePolicy,
  ICircuitBreakerPolicy,
  IPolicyBuilder,
  PolicyExecutionResult,
} from './infrastructure/resilience/IResiliencePolicy';

// ==================== Default Export ====================
export { StruktosApp as default } from './application/host';

// ==================== Version ====================
export const VERSION = '1.0.0';
