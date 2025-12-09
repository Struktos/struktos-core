# Changelog

All notable changes to `@struktos/core` will be documented in this file.

## [1.0.0] - 2025-12-09

### 🎉 Major Release - Platform Identity

Version 1.0.0 establishes Struktos.js as a **standalone backend platform** with its own request processing pipeline, inspired by ASP.NET Core architecture.

### Added

#### Platform Abstractions

**IStruktosMiddleware Interface**
- ASP.NET Core-inspired middleware pattern
- `invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void>`
- Built-in middlewares: `LoggingMiddleware`, `TimingMiddleware`, `ErrorHandlingMiddleware`, `CorsMiddleware`
- `StruktosMiddlewareBase` abstract class for common utilities

**IExceptionFilter Interface**
- NestJS/ASP.NET-style exception handling
- `catch(ctx: ExceptionContext): Promise<StruktosResponse>`
- Built-in filters: `DefaultExceptionFilter`, `HttpExceptionFilter`, `ValidationExceptionFilter`
- `ExceptionFilterChain` for composing multiple filters

**Built-in HTTP Exceptions**
- `HttpException` - Base class
- `BadRequestException` (400)
- `UnauthorizedException` (401)
- `ForbiddenException` (403)
- `NotFoundException` (404)
- `ConflictException` (409)
- `ValidationException` (422)
- `TooManyRequestsException` (429)
- `InternalServerException` (500)
- `ServiceUnavailableException` (503)

#### Hosting System

**StruktosApp Class**
- Main application entry point
- Fluent API for middleware configuration
- Exception filter registration
- Background service management
- `use()`, `useExceptionFilter()`, `addService()`, `listen()`, `run()`, `stop()`

**IAdapter Interface**
- Framework/protocol abstraction
- `IHttpAdapter` - Express, Fastify, etc.
- `IGrpcAdapter` - gRPC services
- `IMessageQueueAdapter` - Kafka, RabbitMQ
- `IWebSocketAdapter` - WebSocket support
- `AdapterBase` abstract class

**IHost Interface**
- Application lifecycle management
- Multi-adapter support
- Graceful shutdown handling
- `StruktosHost` implementation
- `createHost()` factory function

**Background Services**
- `IBackgroundService` interface
- `BackgroundServiceBase` abstract class
- `IntervalService` for periodic tasks

#### Pipeline Utilities

**PipelineBuilder**
- Fluent builder for middleware composition
- `use()`, `prepend()`, `insertAt()`, `compose()`

**Composition Functions**
- `compose()` - Combine middlewares
- `branch()` - Conditional branching
- `forMethods()` - Method-specific middleware
- `forPaths()` - Path-specific middleware
- `wrapErrors()` - Error wrapping
- `parallel()` - Parallel execution
- `withRetry()` - Retry logic
- `withTimeout()` - Timeout handling

#### Type System

**Platform Types**
- `StruktosRequest` - Protocol-agnostic request
- `StruktosResponse` - Protocol-agnostic response
- `ResponseBuilder` - Fluent response builder
- `MiddlewareContext` - Middleware execution context
- `HttpStatus` enum
- `ProtocolType` - 'http' | 'grpc' | 'websocket' | 'graphql' | 'message-queue'

### Enhanced

#### RequestContext
- Added `has()` method
- Added `delete()` method
- Added `clone()` method
- Added `traceId` and `userId` getters
- Added `@RequireContext` decorator

#### CacheManager
- Added `prune()` method for expired entry cleanup
- Added `touch()` method for TTL update
- Added `getOrSetSync()` synchronous variant

### Architecture

```
StruktosApp
├── Middleware Pipeline
│   ├── Timing Middleware (built-in)
│   ├── Error Handling Middleware (built-in)
│   └── User Middlewares
├── Exception Filter Chain
│   ├── User Filters
│   └── Default Filter
├── Background Services
└── Adapters (Express, Fastify, gRPC, etc.)
```

### Compatibility

- **Node.js:** 18.x, 20.x, 21.x
- **TypeScript:** 5.x
- **Adapters:** 
  - `@struktos/adapter-express` ^0.1.0
  - `@struktos/adapter-fastify` ^0.1.0
  - `@struktos/adapter-nestjs` ^0.1.0

---

## [0.1.0] - 2024-12-07

### Initial Release

- `RequestContext` - AsyncLocalStorage-based context propagation
- `IContext` interface
- `CacheManager` - LRU cache with TTL
- Go-style context propagation
- Cancellation token support

---

## Links

- [NPM Package](https://www.npmjs.com/package/@struktos/core)
- [GitHub Repository](https://github.com/struktos/core)
- [Documentation](https://struktos.dev)

---

## License

MIT © Struktos.js Team