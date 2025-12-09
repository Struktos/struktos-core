# @struktos/core v1.0.0

> Enterprise-grade Node.js platform with ASP.NET Core-inspired architecture

[![npm version](https://img.shields.io/npm/v/@struktos/core.svg)](https://www.npmjs.com/package/@struktos/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What's New in v1.0.0

Version 1.0.0 establishes Struktos.js as a **standalone platform** with its own request processing pipeline, inspired by ASP.NET Core architecture.

### Key Features

- ✅ **StruktosApp** - Application entry point with fluent API
- ✅ **IStruktosMiddleware** - ASP.NET Core-style middleware pipeline
- ✅ **IExceptionFilter** - NestJS/ASP.NET-style exception handling
- ✅ **IAdapter** - Framework/protocol abstraction (Express, Fastify, gRPC, etc.)
- ✅ **IHost** - Application lifecycle and hosting management
- ✅ **RequestContext** - Go-style context propagation (enhanced)
- ✅ **Built-in Exceptions** - HTTP exceptions with proper typing
- ✅ **Pipeline Utilities** - Composition, branching, retry, timeout

## 📦 Installation

```bash
npm install @struktos/core
```

## 🚀 Quick Start

```typescript
import { 
  StruktosApp, 
  createMiddleware,
  BadRequestException 
} from '@struktos/core';
import { createExpressAdapter } from '@struktos/adapter-express';

// Create application
const app = StruktosApp.create({ name: 'my-api' });

// Add middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.path}`);
  await next();
});

// Add route handler
app.use(async (ctx, next) => {
  if (ctx.request.path === '/hello') {
    ctx.response.body = { message: 'Hello, World!' };
    return;
  }
  await next();
});

// Start with Express adapter
const adapter = createExpressAdapter();
await app.listen(adapter, 3000);
```

## 📖 Core Concepts

### StruktosApp

The main application class - your entry point for building Struktos applications.

```typescript
const app = StruktosApp.create({
  name: 'my-app',
  port: 3000,
  gracefulShutdown: true,
  useDefaultErrorHandler: true,
});

// Add middleware
app.use(loggingMiddleware);
app.use(authMiddleware);
app.use(routerMiddleware);

// Add exception filters
app.useExceptionFilter(new ValidationExceptionFilter());

// Start
await app.listen(adapter, 3000);
```

### IStruktosMiddleware

ASP.NET Core-inspired middleware with `invoke(ctx, next)` pattern.

```typescript
import { IStruktosMiddleware, MiddlewareContext, NextFunction } from '@struktos/core';

class LoggingMiddleware implements IStruktosMiddleware {
  async invoke(ctx: MiddlewareContext, next: NextFunction): Promise<void> {
    const start = Date.now();
    console.log(`→ ${ctx.request.method} ${ctx.request.path}`);
    
    await next(); // Call next middleware
    
    const duration = Date.now() - start;
    console.log(`← ${ctx.response.status} (${duration}ms)`);
  }
}

// Or use functional style
const loggingMiddleware = createMiddleware(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.path}`);
  await next();
});
```

### IExceptionFilter

Handle exceptions and transform them into responses.

```typescript
import { 
  IExceptionFilter, 
  ExceptionContext, 
  StruktosResponse,
  HttpException 
} from '@struktos/core';

class CustomExceptionFilter implements IExceptionFilter {
  async catch(ctx: ExceptionContext): Promise<StruktosResponse> {
    const { error, context, path, timestamp } = ctx;
    
    if (error instanceof HttpException) {
      return {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: error.name,
          message: error.message,
          traceId: context.get('traceId'),
          timestamp: timestamp.toISOString(),
          path,
        },
      };
    }
    
    throw error; // Pass to next filter
  }
}
```

### Built-in Exceptions

```typescript
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ValidationException,
  TooManyRequestsException,
  InternalServerException,
} from '@struktos/core';

// Usage
throw new BadRequestException('Invalid input');
throw new NotFoundException('User not found');
throw new ValidationException('Validation failed', {
  email: ['Invalid email format'],
  password: ['Password too short'],
});
```

### IAdapter

Abstract interface for framework/protocol adapters.

```typescript
interface IAdapter {
  readonly name: string;
  readonly protocol: ProtocolType;
  
  init(middlewares: IStruktosMiddleware[]): Promise<void>;
  start(port?: number, host?: string): Promise<ServerInfo>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  transformRequest(raw: any): StruktosRequest;
  transformResponse(response: StruktosResponse, raw: any): void;
  createContext(raw: any): MiddlewareContext;
}
```

### IHost

Multi-adapter hosting for microservices.

```typescript
import { createHost, StruktosHost } from '@struktos/core';

const host = createHost({
  name: 'microservice',
  gracefulShutdown: true,
  shutdownTimeout: 30000,
});

host.addAdapter(httpAdapter);
host.addAdapter(grpcAdapter);
host.addBackgroundService(healthCheckService);

await host.start();
```

### Pipeline Utilities

```typescript
import { 
  createPipeline, 
  compose, 
  branch, 
  forMethods, 
  forPaths,
  withRetry,
  withTimeout 
} from '@struktos/core';

// Compose middlewares
const pipeline = compose(logging, auth, validation);

// Conditional branching
const authBranch = branch(
  (ctx) => ctx.request.headers['authorization'] !== undefined,
  authenticatedMiddleware,
  publicMiddleware
);

// Method-specific middleware
const postOnly = forMethods(['POST', 'PUT'], validationMiddleware);

// Path-specific middleware
const apiOnly = forPaths(['/api'], rateLimitMiddleware);

// With retry
const resilientMiddleware = withRetry(externalApiMiddleware, {
  maxRetries: 3,
  retryDelay: 1000,
});

// With timeout
const timedMiddleware = withTimeout(slowMiddleware, 5000);
```

### Background Services

```typescript
import { IntervalService, BackgroundServiceBase } from '@struktos/core';

class HealthCheckService extends IntervalService {
  readonly name = 'health-check';
  
  constructor() {
    super(30000); // Run every 30 seconds
  }
  
  protected async execute(): Promise<void> {
    console.log('Health check running...');
    // Check database, cache, external services, etc.
  }
}

app.addService(new HealthCheckService());
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      StruktosApp                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Middleware Pipeline                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Timing  │→│ Logging │→│  Auth   │→│ Router  │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Exception Filter Chain                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │ Validation │→│    HTTP    │→│  Default   │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                       IAdapter                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │  Express  │ │  Fastify  │ │   gRPC    │ │   Kafka   │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔌 Adapter Ecosystem

| Adapter | Package | Protocol |
|---------|---------|----------|
| Express | `@struktos/adapter-express` | HTTP |
| Fastify | `@struktos/adapter-fastify` | HTTP |
| NestJS | `@struktos/adapter-nestjs` | HTTP |
| gRPC | `@struktos/adapter-grpc` (planned) | gRPC |
| Kafka | `@struktos/adapter-kafka` (planned) | Message Queue |
| RabbitMQ | `@struktos/adapter-rabbitmq` (planned) | Message Queue |

## 🔄 Context Propagation

Go-style context propagation using AsyncLocalStorage.

```typescript
import { RequestContext } from '@struktos/core';

// Context is automatically propagated
async function businessLogic() {
  const ctx = RequestContext.current();
  const traceId = ctx?.get('traceId');
  const userId = ctx?.get('userId');
  
  console.log(`[${traceId}] Processing for user ${userId}`);
  
  // Available in all nested async calls
  await someNestedFunction();
}
```

## 📊 Type Safety

Full TypeScript support with generics:

```typescript
interface MyContextData extends StruktosContextData {
  tenantId: string;
  permissions: string[];
}

const app = StruktosApp.create<MyContextData>();

app.use(async (ctx, next) => {
  // TypeScript knows about tenantId and permissions
  ctx.context.set('tenantId', 'tenant-123');
  ctx.context.set('permissions', ['read', 'write']);
  await next();
});
```

## 🤝 Related Packages

- **[@struktos/adapter-express](https://www.npmjs.com/package/@struktos/adapter-express)** - Express adapter
- **[@struktos/adapter-fastify](https://www.npmjs.com/package/@struktos/adapter-fastify)** - Fastify adapter
- **[@struktos/adapter-nestjs](https://www.npmjs.com/package/@struktos/adapter-nestjs)** - NestJS adapter
- **[@struktos/auth](https://www.npmjs.com/package/@struktos/auth)** - Authentication & authorization
- **[@struktos/logger](https://www.npmjs.com/package/@struktos/logger)** - Structured logging
- **[@struktos/cli](https://www.npmjs.com/package/@struktos/cli)** - Project scaffolding

## 📄 License

MIT © Struktos.js Team

## 🔗 Links

- [GitHub Repository](https://github.com/struktosjs/core)
- [Documentation](https://struktos.dev)
- [NPM Package](https://www.npmjs.com/package/@struktos/core)

---

**Built with ❤️ for enterprise Node.js development**