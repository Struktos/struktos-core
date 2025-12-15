# @struktos/core v1.0.0

Enterprise-grade Node.js Framework for building scalable, maintainable applications using Hexagonal Architecture and Domain-Driven Design principles.

[![npm version](https://badge.fury.io/js/%40struktos%2Fcore.svg)](https://www.npmjs.com/package/@struktos/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **Context Propagation** | Go-style AsyncLocalStorage-based context that automatically propagates across async boundaries |
| 📝 **CQRS Pattern** | Command/Query Responsibility Segregation with handlers, buses, and pipeline behaviors |
| 💾 **Unit of Work** | Transaction management with savepoint support and repository pattern integration |
| 📋 **Specification Pattern** | Composable business rules with AND/OR/NOT operators |
| 🏠 **Application Host** | ASP.NET Core-inspired hosting model with background services |
| 🔌 **Middleware Pipeline** | Composable middleware with branching, retry, and timeout support |
| 🚨 **Exception Filters** | Centralized exception handling with filter chains |
| 🔍 **Distributed Tracing** | OpenTelemetry-compatible tracing with span management |
| 🛡️ **Resilience Policies** | Circuit breaker, retry, timeout, and bulkhead patterns |
| ⚡ **LRU Cache** | High-performance caching with TTL and statistics |

## 📦 Installation

```bash
npm install @struktos/core
# or
yarn add @struktos/core
# or
pnpm add @struktos/core
```

## 🚀 Quick Start

### 1. Context Propagation

Go-style context automatically propagates through all async operations without manual passing.

```typescript
import { RequestContext, getCurrentContext } from '@struktos/core';

// Create context scope
RequestContext.run({ traceId: 'trace-123', userId: 'user-456' }, async () => {
  // Context automatically available in all nested async calls
  await processOrder();
});

async function processOrder() {
  const ctx = RequestContext.current();
  console.log('TraceID:', ctx?.get('traceId')); // 'trace-123'
  
  // Context propagates through Promise chains, callbacks, timers
  await validateOrder();
  await saveOrder();
}

// With cancellation support
const ctx = getCurrentContext();
ctx.onCancel(() => {
  console.log('Operation cancelled, cleaning up...');
});

// Cancel the context (triggers all registered callbacks)
ctx.cancel();
```

### 2. CQRS Pattern

Separate read and write operations for better scalability and maintainability.

```typescript
import {
  CommandBase,
  QueryBase,
  ICommandHandler,
  IQueryHandler,
  HandlerContext
} from '@struktos/core';

// Define a command (write operation)
class CreateUserCommand extends CommandBase<string> {
  constructor(
    public readonly email: string,
    public readonly name: string
  ) {
    super();
  }
}

// Implement command handler
class CreateUserHandler implements ICommandHandler<CreateUserCommand, string> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(command: CreateUserCommand, context?: HandlerContext): Promise<string> {
    // Check cancellation
    if (context?.isCancelled()) {
      throw new Error('Operation cancelled');
    }

    const user = await this.userRepo.create({
      email: command.email,
      name: command.name
    });

    return user.id;
  }
}

// Define a query (read operation)
class GetUserByIdQuery extends QueryBase<User | null> {
  constructor(public readonly userId: string) {
    super();
  }
}

// Implement query handler with caching
class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.userRepo.findById(query.userId);
  }
}
```

### 3. Unit of Work Pattern

Manage transactions across multiple repository operations atomically.

```typescript
import { IUnitOfWork, IsolationLevel } from '@struktos/core';

class TransferFundsUseCase {
  constructor(private readonly uowFactory: IUnitOfWorkFactory) {}

  async execute(fromId: string, toId: string, amount: number): Promise<void> {
    const uow = this.uowFactory.create();

    await uow.executeInTransaction(async (unitOfWork) => {
      const accountRepo = unitOfWork.getRepository<IAccountRepository>('AccountRepository');

      // Debit source account
      const source = await accountRepo.findById(fromId);
      if (source.balance < amount) {
        throw new InsufficientFundsError();
      }
      await accountRepo.update(fromId, { balance: source.balance - amount });

      // Credit destination account
      const dest = await accountRepo.findById(toId);
      await accountRepo.update(toId, { balance: dest.balance + amount });

    }, { isolationLevel: IsolationLevel.Serializable });
  }
}

// With savepoints for partial rollback
await uow.start();
await createUser(uow);

await uow.createSavepoint('before_order');
try {
  await createOrder(uow);
} catch (error) {
  await uow.rollbackToSavepoint('before_order');
  // User is kept, order is rolled back
}

await uow.commit();
```

### 4. Specification Pattern

Encapsulate business rules as composable, reusable objects.

```typescript
import { SpecificationBase, ISpecification } from '@struktos/core';

// Define specifications
class ActiveUserSpec extends SpecificationBase<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive && !user.isDeleted;
  }
}

class PremiumUserSpec extends SpecificationBase<User> {
  isSatisfiedBy(user: User): boolean {
    return user.subscriptionTier === 'premium';
  }
}

class MinimumAgeSpec extends SpecificationBase<User> {
  constructor(private readonly minAge: number) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.age >= this.minAge;
  }
}

// Compose specifications
const eligibleForPromotion = new ActiveUserSpec()
  .and(new PremiumUserSpec())
  .and(new MinimumAgeSpec(18));

// Use in filtering
const eligibleUsers = users.filter(u => eligibleForPromotion.isSatisfiedBy(u));

// Use in repository queries
const users = await userRepo.findBySpec(eligibleForPromotion);
```

### 5. Application Host

ASP.NET Core-inspired application hosting with middleware and background services.

```typescript
import {
  createApp,
  StruktosApp,
  LoggingMiddleware,
  TimingMiddleware,
  ErrorHandlingMiddleware,
  BackgroundServiceBase
} from '@struktos/core';

// Create application
const app = createApp<MyContextData>({
  name: 'MyService',
  version: '1.0.0'
});

// Add middleware pipeline
app.use(new TimingMiddleware());
app.use(new LoggingMiddleware(logger));
app.use(new ErrorHandlingMiddleware());

// Add exception filters
app.useExceptionFilter(new ValidationExceptionFilter());
app.useExceptionFilter(new HttpExceptionFilter());

// Add background service
class HealthCheckService extends BackgroundServiceBase {
  protected async executeAsync(): Promise<void> {
    while (!this.isStopping) {
      await this.checkHealth();
      await this.delay(30000); // Check every 30 seconds
    }
  }
}

app.addService(new HealthCheckService());

// Start application
await app.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.stop();
});
```

### 6. Middleware Pipeline

Composable middleware with advanced features.

```typescript
import {
  PipelineBuilder,
  createPipeline,
  compose,
  branch,
  forMethods,
  forPaths,
  withRetry,
  withTimeout
} from '@struktos/core';

// Build pipeline
const pipeline = new PipelineBuilder<MyContext>()
  .use(new AuthenticationMiddleware())
  .use(new RateLimitMiddleware())
  .use(new LoggingMiddleware())
  .build();

// Conditional branching
const adminPipeline = branch(
  (ctx) => ctx.request.path.startsWith('/admin'),
  new AdminAuthMiddleware()
);

// Method-specific middleware
const postOnly = forMethods(['POST', 'PUT'], new ValidationMiddleware());

// Path-specific middleware
const apiMiddleware = forPaths(['/api/*'], new ApiKeyMiddleware());

// With retry and timeout
const resilientHandler = compose(
  withTimeout(5000),
  withRetry({ maxRetries: 3, delay: 1000 })
)(myHandler);
```

### 7. Distributed Tracing

OpenTelemetry-compatible tracing for observability.

```typescript
import { ITracer, SpanKind, SpanStatus } from '@struktos/core';

async function processPayment(tracer: ITracer, orderId: string, amount: number) {
  return tracer.withSpan(
    'processPayment',
    async (span) => {
      span.setAttributes({
        'payment.orderId': orderId,
        'payment.amount': amount,
        'payment.currency': 'USD'
      });

      try {
        // Create child span for gateway call
        const result = await tracer.withSpan('gateway.charge', async (childSpan) => {
          childSpan.setAttribute('gateway.name', 'stripe');
          return paymentGateway.charge(amount);
        }, { kind: SpanKind.Client });

        span.setStatus(SpanStatus.Ok);
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus(SpanStatus.Error, error.message);
        throw error;
      }
    },
    { kind: SpanKind.Internal }
  );
}

// Context propagation for cross-service tracing
const headers = tracer.inject({});
await fetch('https://api.example.com', { headers });

// Extract context from incoming request
const parentContext = tracer.extract(request.headers);
const span = tracer.startSpan('handleRequest', { parent: parentContext });
```

### 8. Resilience Policies

Build fault-tolerant applications with resilience patterns.

```typescript
import {
  IResiliencePolicy,
  CircuitState,
  PolicyResult
} from '@struktos/core';

// Circuit Breaker
const circuitBreaker = policyBuilder
  .circuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds open state
    halfOpenRequests: 3
  })
  .build();

// Retry with exponential backoff
const retryPolicy = policyBuilder
  .retry({
    maxRetries: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    retryOn: [NetworkError, TimeoutError]
  })
  .build();

// Timeout
const timeoutPolicy = policyBuilder
  .timeout(5000)
  .build();

// Bulkhead (concurrency limiter)
const bulkhead = policyBuilder
  .bulkhead({
    maxConcurrent: 10,
    maxQueue: 100
  })
  .build();

// Combine policies (wrap order: timeout → retry → circuit breaker)
const resilientPolicy = policyBuilder
  .wrap(timeoutPolicy, retryPolicy, circuitBreaker)
  .build();

// Execute with policy
const result = await resilientPolicy.execute(async (ctx) => {
  return fetchExternalService();
});
```

### 9. LRU Cache

High-performance caching with TTL support.

```typescript
import { CacheManager, createCacheManager } from '@struktos/core';

// Create cache
const cache = createCacheManager<string, User>({
  maxSize: 1000,
  defaultTTL: 60000 // 60 seconds
});

// Basic operations
cache.set('user:123', user, 300000); // 5 min TTL
const user = cache.get('user:123');

// Get or set pattern
const user = await cache.getOrSet('user:123', async () => {
  return userRepo.findById('123');
}, 60000);

// Cache statistics
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)}%`);

// Prune expired entries
cache.prune();

// Touch to refresh TTL
cache.touch('user:123');
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │  StruktosApp  │  │   CQRS Bus    │  │  Background Services  │   │
│  │  (Host)       │  │ Command/Query │  │  (IBackgroundService) │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                         Domain Layer                                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ RequestContext│  │  Unit of Work │  │    Specification      │   │
│  │ (IContext)    │  │  (IUnitOfWork)│  │  (ISpecification)     │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                      Infrastructure Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Middleware │ │   Tracing   │ │  Resilience │ │    Cache    │  │
│  │  Pipeline   │ │  (ITracer)  │ │  Policies   │ │   Manager   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                         Adapter Layer                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │  Express  │ │  Fastify  │ │   gRPC    │ │  Message Queue    │  │
│  │  Adapter  │ │  Adapter  │ │  Adapter  │ │  (Kafka/RabbitMQ) │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 📚 Module Exports

### Domain Layer

| Export | Description |
|--------|-------------|
| `IContext`, `StruktosContextData` | Context interface and standard data types |
| `RequestContext` | AsyncLocalStorage-based context implementation |
| `IUnitOfWork`, `IUnitOfWorkFactory` | Transaction management interfaces |
| `IsolationLevel`, `TransactionState` | Transaction enums |
| `ISpecification`, `SpecificationBase` | Specification pattern abstractions |
| `HttpException`, `ValidationException` | Domain exception classes |

### Application Layer

| Export | Description |
|--------|-------------|
| `ICommand`, `IQuery` | CQRS message interfaces |
| `ICommandHandler`, `IQueryHandler` | Handler interfaces |
| `ICommandBus`, `IQueryBus` | Bus interfaces for dispatching |
| `IPipelineBehavior` | Cross-cutting concern wrapper |
| `StruktosApp`, `createApp` | Application host |
| `IBackgroundService` | Background service interface |

### Infrastructure Layer

| Export | Description |
|--------|-------------|
| `IStruktosMiddleware` | Middleware interface |
| `PipelineBuilder`, `createPipeline` | Pipeline utilities |
| `ITracer`, `ISpan` | Distributed tracing |
| `IResiliencePolicy`, `ICircuitBreakerPolicy` | Resilience patterns |
| `CacheManager`, `createCacheManager` | LRU cache |

## 🔌 Adapter Ecosystem

| Package | Protocol | Status |
|---------|----------|--------|
| `@struktos/adapter-express` | HTTP (Express.js) | ✅ Stable |
| `@struktos/adapter-fastify` | HTTP (Fastify) | ✅ Stable |
| `@struktos/adapter-nestjs` | HTTP (NestJS) | ✅ Stable |
| `@struktos/adapter-grpc` | gRPC | ✅ Stable |
| `@struktos/prisma` | Database (Prisma) | ✅ Stable |
| `@struktos/auth` | Authentication | ✅ Stable |
| `@struktos/cli` | CLI Tools | ✅ Stable |

## 🎯 Design Principles

### Hexagonal Architecture (Ports & Adapters)

- **Core logic is adapter-agnostic**: Business rules don't depend on Express, Fastify, or any specific framework
- **Ports define contracts**: Interfaces like `IUnitOfWork`, `ITracer` define what the application needs
- **Adapters implement contracts**: `PrismaUnitOfWork`, `OpenTelemetryTracer` provide concrete implementations

### Enterprise Patterns

- **Unit of Work**: Atomic transactions across multiple repositories
- **CQRS**: Separate read/write models for scalability
- **Specification**: Encapsulated, composable business rules
- **Repository**: Data access abstraction

### TypeScript First

- Complete type safety with strict mode
- Generic interfaces for maximum flexibility
- Comprehensive TSDoc documentation

## 📖 API Reference

Full API documentation is available at [struktos.dev/api/core](https://struktos.dev/api/core).

## 🧪 Testing

```bash
npm test              # Run tests
npm run test:coverage # Run with coverage
npm run test:watch    # Watch mode
```

## 📄 License

MIT © Struktos Contributors

## 🔗 Links

- [Documentation](https://struktos.dev)
- [GitHub Repository](https://github.com/struktos/core)
- [NPM Package](https://www.npmjs.com/package/@struktos/core)
- [Changelog](./CHANGELOG.md)