# @struktos/core v1.0.0

Enterprise-grade Node.js Framework for building scalable, maintainable applications using Hexagonal Architecture, Domain-Driven Design, and Dependency Injection.

[![npm version](https://badge.fury.io/js/%40struktos%2Fcore.svg)](https://www.npmjs.com/package/@struktos/core)
[![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](https://codecov.io/gh/struktos/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💉 **Dependency Injection** | ASP.NET Core-style DI with Singleton/Scoped/Transient lifetimes, automatic circular dependency detection |
| 📢 **Domain Events** | DDD-style event sourcing with transactional consistency, event handlers, and aggregate root pattern |
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

### 1. Dependency Injection

ASP.NET Core-style dependency injection with automatic lifecycle management.

```typescript
import {
  ServiceScope,
  Injectable,
  Inject,
  IServiceCollection,
  IServiceProvider
} from '@struktos/core/application/di';

// Define services with decorators
@Injectable({ scope: ServiceScope.Singleton })
class ConfigService {
  getConfig(key: string): string {
    return process.env[key] || '';
  }
}

@Injectable({ scope: ServiceScope.Singleton })
class LoggerService {
  constructor(@Inject(ConfigService) private config: ConfigService) {}
  
  log(message: string): void {
    console.log(`[${this.config.getConfig('APP_NAME')}] ${message}`);
  }
}

@Injectable({ scope: ServiceScope.Scoped })
class DatabaseContext {
  constructor(@Inject(LoggerService) private logger: LoggerService) {
    this.logger.log('DatabaseContext created for this request');
  }
  
  async query(sql: string): Promise<any[]> {
    // Execute query
    return [];
  }
}

@Injectable({ scope: ServiceScope.Scoped })
class UserRepository {
  constructor(
    @Inject(DatabaseContext) private db: DatabaseContext,
    @Inject(LoggerService) private logger: LoggerService
  ) {}
  
  async findById(id: string): Promise<User | null> {
    this.logger.log(`Finding user ${id}`);
    const results = await this.db.query(`SELECT * FROM users WHERE id = ?`);
    return results[0] || null;
  }
}

// Register services
const services = new ServiceCollection();
services.addSingleton(ConfigService);
services.addSingleton(LoggerService);
services.addScoped(DatabaseContext);
services.addScoped(UserRepository);

// Build provider
const provider = services.buildServiceProvider();

// Resolve services (in request scope)
const scope = provider.createScope();
const scopedProvider = scope.getServiceProvider();

const userRepo = scopedProvider.getService(UserRepository);
const user = await userRepo.findById('user-123');

// Automatic cleanup
scope.dispose();
```

**Lifecycle Rules Enforced:**
```typescript
✅ Singleton → Singleton (allowed)
✅ Scoped → Singleton, Scoped (allowed)
✅ Transient → Singleton, Scoped, Transient (allowed)
❌ Singleton → Scoped (FORBIDDEN - prevents data leaks!)
❌ Singleton → Transient (FORBIDDEN - lifecycle violation!)
```

**Circular Dependency Detection:**
```typescript
// Automatic detection with visual graph
try {
  provider.getService(ServiceA);
} catch (error: DependencyResolutionError) {
  console.log(error.message);
  // "Circular dependency detected: ServiceA → ServiceB → ServiceA"
  
  console.log(error.dependencyGraph);
  /*
  ServiceA (Singleton)
    └── ServiceB (Singleton)
          └── ServiceA (CIRCULAR!)
  */
}
```

---

### 2. Domain Events

DDD-style domain events with transactional consistency guarantee.

```typescript
import {
  IDomainEvent,
  IEventRaisingEntity,
  IEventBus,
  IEventHandler,
  EventMetadata
} from '@struktos/core/domain/events';

// Define event
interface OrderCreatedPayload {
  orderId: string;
  customerId: string;
  total: number;
}

class OrderCreatedEvent implements IDomainEvent<OrderCreatedPayload> {
  public readonly eventName = 'OrderCreated';
  public readonly metadata: EventMetadata;
  
  constructor(public readonly payload: OrderCreatedPayload) {
    this.metadata = {
      eventId: `evt-${Date.now()}`,
      occurredAt: new Date().toISOString(),
    };
  }
}

// Define aggregate root
abstract class AggregateRoot implements IEventRaisingEntity {
  private _domainEvents: IDomainEvent[] = [];
  
  get domainEvents(): readonly IDomainEvent[] {
    return this._domainEvents;
  }
  
  protected raiseEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }
  
  clearEvents(): void {
    this._domainEvents = [];
  }
}

// Domain entity
class Order extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly total: number
  ) {
    super();
  }
  
  static create(customerId: string, total: number): Order {
    const order = new Order(`order-${Date.now()}`, customerId, total);
    
    // Raise event (stored internally, NOT published yet)
    order.raiseEvent(new OrderCreatedEvent({
      orderId: order.id,
      customerId: order.customerId,
      total: order.total
    }));
    
    return order;
  }
}

// Event handler
class SendOrderConfirmationEmailHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Sending confirmation email for order ${event.payload.orderId}`);
    // Send email...
  }
}

class UpdateInventoryHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Updating inventory for order ${event.payload.orderId}`);
    // Update inventory...
  }
}

// Complete flow with Unit of Work
async function createOrderUseCase(customerId: string, total: number) {
  const uow = unitOfWorkFactory.create();
  
  await uow.start();
  
  try {
    // Create aggregate
    const order = Order.create(customerId, total);
    
    // Save to repository
    const orderRepo = uow.getRepository<OrderRepository>('OrderRepository');
    await orderRepo.save(order);
    
    // Extract events and buffer them in UoW
    const events = [...order.domainEvents];
    order.clearEvents();
    uow.addDomainEvents(events);
    
    // Commit transaction
    await uow.commit(); // ← Events published ONLY if commit succeeds
    
    // Email sent!
    // Inventory updated!
    
  } catch (error) {
    await uow.rollback(); // ← Events discarded (NOT published)
    
    // No email sent!
    // No inventory updated!
    // Data consistency maintained!
    
    throw error;
  }
}
```

**Key Guarantees:**
- ✅ Events stored internally by aggregate (domain purity)
- ✅ Events published ONLY after successful DB commit
- ✅ Events discarded on transaction rollback
- ✅ Multiple handlers can process same event
- ✅ Handlers are independent and idempotent

---

### 3. Context Propagation

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

**Integration with DI Scoped Services:**
```typescript
// Scoped services automatically tied to RequestContext
RequestContext.run({ traceId: 'trace-abc' }, async () => {
  const scope = provider.createScope(); // Tied to this RequestContext
  
  const dbContext = scope.getServiceProvider().getService(DatabaseContext);
  
  // All operations share same DatabaseContext instance
  await operation1(dbContext);
  await operation2(dbContext);
  
  // Automatic disposal when context ends
  scope.dispose();
});
```

---

### 4. CQRS Pattern

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

---

### 5. Unit of Work Pattern

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

---

### 6. Specification Pattern

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

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │  StruktosApp  │  │   CQRS Bus    │  │  Background Services  │   │
│  │  (Host)       │  │ Command/Query │  │  (IBackgroundService) │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Dependency Injection Container                   │  │
│  │  ServiceCollection → ServiceProvider → ServiceScope           │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                         Domain Layer                                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ RequestContext│  │  Unit of Work │  │    Specification      │   │
│  │ (IContext)    │  │  (IUnitOfWork)│  │  (ISpecification)     │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Domain Events System                       │  │
│  │  AggregateRoot → Events (stored) → EventBus → EventHandlers  │  │
│  └───────────────────────────────────────────────────────────────┘  │
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

---

## 📚 Module Exports

### Domain Layer

| Export | Description |
|--------|-------------|
| `IContext`, `StruktosContextData` | Context interface and standard data types |
| `RequestContext` | AsyncLocalStorage-based context implementation |
| `IDomainEvent`, `EventMetadata` | Domain event interfaces |
| `IEventRaisingEntity`, `IEventBus`, `IEventHandler` | Event system interfaces |
| `IUnitOfWork`, `IUnitOfWorkFactory` | Transaction management interfaces |
| `IsolationLevel`, `TransactionState` | Transaction enums |
| `ISpecification`, `SpecificationBase` | Specification pattern abstractions |
| `HttpException`, `ValidationException` | Domain exception classes |

### Application Layer

| Export | Description |
|--------|-------------|
| `IServiceCollection`, `IServiceProvider`, `IServiceScope` | DI container interfaces |
| `ServiceScope` | Service lifetime enum (Singleton/Scoped/Transient) |
| `@Injectable()`, `@Inject()` | DI decorators |
| `DependencyResolutionError` | DI error with dependency graph |
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

---

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

---

## 🎯 Design Principles

### Hexagonal Architecture (Ports & Adapters)

- **Core logic is adapter-agnostic**: Business rules don't depend on Express, Fastify, or any specific framework
- **Ports define contracts**: Interfaces like `IUnitOfWork`, `ITracer`, `IEventBus` define what the application needs
- **Adapters implement contracts**: `PrismaUnitOfWork`, `OpenTelemetryTracer`, `InMemoryEventBus` provide concrete implementations

### Enterprise Patterns

- **Dependency Injection**: Automatic lifecycle management, circular dependency detection
- **Domain Events**: Transactional consistency, aggregate root pattern, event handlers
- **Unit of Work**: Atomic transactions across multiple repositories
- **CQRS**: Separate read/write models for scalability
- **Specification**: Encapsulated, composable business rules
- **Repository**: Data access abstraction

### TypeScript First

- Complete type safety with strict mode
- Generic interfaces for maximum flexibility
- Comprehensive TSDoc documentation (3,500+ lines)
- 90%+ test coverage enforced

---

## 🧪 Testing

```bash
npm test              # Run tests
npm run test:coverage # Run with coverage (90%+ required)
npm run test:watch    # Watch mode
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests only
```

**Test Coverage:**
- DI Container: 95%+ (circular dependency, scope mismatch, lifecycle)
- Domain Events: 95%+ (aggregate purity, transactional consistency)
- Context Propagation: 95%+ (AsyncLocalStorage, concurrent requests)
- Overall: 90%+ enforced by CI/CD

---

## 📄 License

MIT © Struktos Contributors

---

## 🔗 Links

- [Documentation](https://struktos.dev)
- [GitHub Repository](https://github.com/struktos/core)
- [NPM Package](https://www.npmjs.com/package/@struktos/core)
- [Changelog](./CHANGELOG.md)
- [Testing Rationale](./TESTING_RATIONALE.md)
- [API Reference](https://struktos.dev/api/core)