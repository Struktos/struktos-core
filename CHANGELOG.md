# Changelog

All notable changes to `@struktos/core` will be documented in this file.

## [1.0.0-beta.1] - 2025-12-22

### 🎉 Major Release - Enterprise Architecture Platform

Version 1.0.0 establishes Struktos.js as a **complete enterprise backend platform** with Hexagonal Architecture, Domain-Driven Design, and comprehensive dependency injection.

---

### Added

#### Dependency Injection System

**IServiceCollection Interface**
- Service registration with lifetime management
- `addSingleton()` - One instance per application
- `addScoped()` - One instance per request context
- `addTransient()` - New instance every resolution
- Fluent API for service registration

**IServiceProvider Interface**
- Service resolution with dependency graph management
- `getService<T>()` - Resolve service by type
- `getRequiredService<T>()` - Resolve with throw if not found
- `createScope()` - Create new dependency injection scope
- Automatic circular dependency detection

**IServiceScope Interface**
- Scoped service lifetime management
- Automatic disposal of scoped services
- Integration with RequestContext for per-request isolation
- `dispose()` - Clean up scoped resources

**@Injectable() Decorator**
- Marks classes for automatic registration
- Scope specification (Singleton/Scoped/Transient)
- Metadata-based registration

**@Inject() Decorator**
- Constructor parameter injection
- Property injection (for circular dependencies)
- Type-safe dependency resolution

**DependencyResolutionError Class**
- Comprehensive error information
- Visual dependency graph generation
- Four error scenarios:
  - Unregistered service detection
  - Circular dependency detection
  - Missing dependencies identification
  - Scope mismatch prevention

**Architecture Guarantees:**
```typescript
✅ Singleton can inject: Singleton
✅ Scoped can inject: Singleton, Scoped
✅ Transient can inject: Singleton, Scoped, Transient
❌ Singleton CANNOT inject: Scoped, Transient (enforced at runtime)
❌ Scoped CANNOT inject: Transient (usually enforced)
```

---

#### Domain Events System

**IDomainEvent Interface**
- Generic event interface with typed payload
- `eventName` - Event type identifier for routing
- `metadata` - Event metadata (eventId, occurredAt, correlationId, etc.)
- `payload` - Strongly-typed event data

**EventMetadata Interface**
- `eventId` - Unique event identifier for deduplication
- `occurredAt` - ISO timestamp for event ordering
- `correlationId` - Optional correlation ID for distributed tracing
- `actorId` - Optional actor/user who triggered the event
- `context` - Optional additional context data

**IEventRaisingEntity Interface**
- Domain purity pattern for aggregates
- `domainEvents` - Readonly array of raised events
- `raiseEvent()` - Store event internally (NOT publish)
- `clearEvents()` - Clear events after extraction

**IEventBus Interface**
- Event publishing infrastructure
- `publish()` - Publish single event asynchronously
- `publishAll()` - Publish multiple events atomically
- `publishSync()` - Synchronous event publishing
- `registerHandler()` - Register event handlers

**IEventHandler Interface**
- Event handler contract
- `handle()` - Process domain event
- Single Responsibility Principle enforcement
- Idempotent handler design

**Architecture Flow:**
```
1. Aggregate raises event → stored internally
2. Repository saves aggregate → extracts events
3. Unit of Work buffers events during transaction
4. Transaction commits → events published ONLY if commit succeeds
5. Transaction rollbacks → events discarded (NOT published)
```

**Domain Purity Guarantee:**
```typescript
✅ Domain entities NEVER depend on IEventBus
✅ Events stored internally, not published immediately
✅ Repository extracts and publishes events
✅ Unit of Work ensures transactional consistency
❌ NEVER: Events published before DB commit
```

---

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

---

#### Hosting System

**StruktosApp Class**
- Main application entry point
- Fluent API for middleware configuration
- Exception filter registration
- Background service management
- Dependency injection container integration
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

---

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

---

#### Type System

**Platform Types**
- `StruktosRequest` - Protocol-agnostic request
- `StruktosResponse` - Protocol-agnostic response
- `ResponseBuilder` - Fluent response builder
- `MiddlewareContext` - Middleware execution context
- `HttpStatus` enum
- `ProtocolType` - 'http' | 'grpc' | 'websocket' | 'graphql' | 'message-queue'

---

### Enhanced

#### RequestContext
- Added `has()` method
- Added `delete()` method
- Added `clone()` method
- Added `traceId` and `userId` getters
- Added `@RequireContext` decorator
- **Integration with DI Scoped services**: Scoped services automatically tied to RequestContext lifetime

#### CacheManager
- Added `prune()` method for expired entry cleanup
- Added `touch()` method for TTL update
- Added `getOrSetSync()` synchronous variant

---

### Architecture

```
StruktosApp
├── Dependency Injection Container
│   ├── ServiceCollection (registration)
│   ├── ServiceProvider (resolution)
│   └── ServiceScope (per-request)
├── Domain Events System
│   ├── Event Raising (Aggregates)
│   ├── Event Bus (Publishing)
│   └── Event Handlers
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

---

### Hexagonal Architecture Enforcement

**Layer Separation:**
```
DOMAIN (Pure Business Logic)
  ├── No infrastructure dependencies
  ├── Domain Events (raised, not published)
  └── Specifications (business rules)
       ↓ Dependencies flow INWARD only
APPLICATION (Use Case Orchestration)
  ├── DI Container (cross-cutting)
  ├── CQRS Handlers
  └── Unit of Work coordination
       ↓ Dependencies flow INWARD only
INFRASTRUCTURE (External Concerns)
  ├── Event Bus implementation
  ├── Repository implementations
  └── Adapters (HTTP, gRPC, etc.)
```

**Enforced Rules:**
- ✅ Domain NEVER depends on infrastructure
- ✅ Events stored internally, published by infrastructure
- ✅ Scope violations detected at runtime
- ✅ Circular dependencies prevented

---

### Compatibility

- **Node.js:** 18.x, 20.x, 22.x
- **TypeScript:** 5.x
- **Testing:** Jest with 90%+ coverage requirement
- **Adapters:** 
  - `@struktos/adapter-express` ^0.1.0
  - `@struktos/adapter-fastify` ^0.1.0
  - `@struktos/adapter-nestjs` ^0.1.0
  - `@struktos/adapter-grpc` ^0.1.0

---

### Testing Infrastructure

**Unit Tests:**
- DI Container: Circular dependency, scope mismatch, lifecycle
- Domain Events: Aggregate purity, event raising, clearing
- Coverage: 90%+ enforced

**Integration Tests:**
- UoW + EventBus: Atomic transaction-event publishing
- Context Propagation: AsyncLocalStorage across async boundaries
- Concurrent Requests: Isolation validation

**CI/CD:**
- GitHub Actions workflows (ci.yml, auto-release.yml)
- Matrix testing (Node 18, 20, 22)
- Automatic npm publishing with provenance
- Coverage threshold enforcement (90%+)

---

## [0.1.0] - 2025-12-07

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
- [Testing Rationale](./TESTING_RATIONALE.md)

---

## License

MIT © Struktos.js Team