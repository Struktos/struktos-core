/**
 * @fileoverview Dependency Injection Container Interfaces
 * 
 * @packageDocumentation
 * @module @struktos/core/application/di
 * 
 * ## Hexagonal Architecture Layer: APPLICATION
 * 
 * This file belongs to the **Application Layer**, which orchestrates
 * domain logic and manages cross-cutting concerns like DI.
 * 
 * Application layer:
 * - ✅ **CAN**: Define service registration and resolution interfaces
 * - ✅ **CAN**: Manage service lifecycles and scopes
 * - ✅ **CAN**: Integrate with infrastructure (AsyncLocalStorage)
 * - ❌ **CANNOT**: Contain domain business logic
 * - ❌ **CANNOT**: Know about specific database or HTTP implementations
 * 
 * ## Architectural Responsibility
 * 
 * This module provides **Dependency Injection (DI)** abstractions inspired
 * by ASP.NET Core's DI system. The DI container:
 * 
 * 1. **Inverts Dependencies**: High-level modules depend on abstractions, not concrete implementations
 * 2. **Manages Lifecycles**: Controls when instances are created and destroyed
 * 3. **Resolves Dependencies**: Automatically injects dependencies into constructors
 * 4. **Supports Scoping**: Ties service instances to request contexts via AsyncLocalStorage
 * 
 * ## Why Dependency Injection?
 * 
 * **The Problem Without DI:**
 * 
 * ```typescript
 * // ❌ Tightly coupled - hard to test, hard to change
 * class UserService {
 *   private db = new PostgresDatabase();  // Hard-coded dependency
 *   private logger = new ConsoleLogger();  // Hard-coded dependency
 *   
 *   async getUser(id: string) {
 *     this.logger.info('Fetching user');
 *     return this.db.users.findById(id);
 *   }
 * }
 * 
 * // Testing is painful:
 * // - Can't mock database
 * // - Can't mock logger
 * // - UserService creates its own dependencies
 * ```
 * 
 * **The Solution With DI:**
 * 
 * ```typescript
 * // ✅ Loosely coupled - easy to test, easy to change
 * @Injectable({ scope: ServiceScope.Scoped })
 * class UserService {
 *   constructor(
 *     @Inject(IDatabase) private db: IDatabase,      // Abstraction
 *     @Inject(ILogger) private logger: ILogger        // Abstraction
 *   ) {}
 *   
 *   async getUser(id: string) {
 *     this.logger.info('Fetching user');
 *     return this.db.users.findById(id);
 *   }
 * }
 * 
 * // Testing is easy:
 * const mockDb = createMock<IDatabase>();
 * const mockLogger = createMock<ILogger>();
 * const service = new UserService(mockDb, mockLogger);
 * ```
 * 
 * ## Service Lifecycles Explained
 * 
 * The DI container supports three lifecycle scopes:
 * 
 * ### 1. Singleton (Application-Wide)
 * 
 * ```
 * Request 1 → ServiceA (instance-1)
 * Request 2 → ServiceA (instance-1)  ← Same instance!
 * Request 3 → ServiceA (instance-1)  ← Same instance!
 * ```
 * 
 * **Use Cases:**
 * - Configuration services (never change during app lifetime)
 * - Connection pools (expensive to create, shared across requests)
 * - Stateless services (like validators, formatters)
 * 
 * **⚠️ Warning:** Singletons must be thread-safe (async-safe in Node.js).
 * Never store request-specific state in singletons!
 * 
 * ### 2. Transient (Always New)
 * 
 * ```
 * Request 1 → ServiceB (instance-1)
 *          → ServiceB (instance-2)  ← New instance each resolve!
 *          → ServiceB (instance-3)  ← New instance each resolve!
 * ```
 * 
 * **Use Cases:**
 * - Lightweight services with no state
 * - Services that must be isolated
 * - Command/Query handlers (each request gets fresh handler)
 * 
 * **⚠️ Warning:** Beware of memory leaks if transient services hold
 * references to long-lived objects.
 * 
 * ### 3. Scoped (Request-Scoped via AsyncLocalStorage)
 * 
 * ```
 * Request 1 → ServiceC (instance-1)  ← Created once per request
 *          → ServiceC (instance-1)  ← Same instance within request
 *          → ServiceC (instance-1)  ← Same instance within request
 *          
 * Request 2 → ServiceC (instance-2)  ← New instance for new request
 *          → ServiceC (instance-2)  ← Same instance within request
 * ```
 * 
 * **Critical Integration with RequestContext:**
 * 
 * Scoped services are tied to `RequestContext` via AsyncLocalStorage.
 * This means:
 * 
 * 1. Each `RequestContext.run()` scope gets its own service instances
 * 2. Services are automatically disposed when the scope ends
 * 3. Context data is accessible within scoped services
 * 
 * ```typescript
 * // HTTP middleware creates scope
 * app.use((req, res, next) => {
 *   RequestContext.run({ traceId: generateId() }, async () => {
 *     const scope = serviceProvider.createScope();  // Creates scoped container
 *     
 *     try {
 *       // All scoped services share this context
 *       const userService = scope.getServiceProvider().getService(UserService);
 *       await userService.doWork();  // Can access RequestContext.current()
 *     } finally {
 *       scope.dispose();  // Cleanup scoped instances
 *     }
 *   });
 * });
 * ```
 * 
 * **Use Cases:**
 * - Database connections (one per request, disposed after)
 * - Unit of Work (transaction per request)
 * - Request-specific loggers (with trace ID from context)
 * - User session state
 * 
 * ## Dependency Resolution Process
 * 
 * **How the Container Resolves Dependencies:**
 * 
 * ```
 * Step 1: User requests service
 *   provider.getService(UserController)
 *     ↓
 * Step 2: Container inspects constructor
 *   UserController(UserService, LoggerService)
 *     ↓
 * Step 3: Recursively resolve dependencies
 *   UserService → requires (IDatabase, ILogger)
 *   LoggerService → requires (IConfig)
 *     ↓
 * Step 4: Create instances in dependency order
 *   4a. Create IConfig instance
 *   4b. Create IDatabase instance
 *   4c. Create ILogger instance (using IConfig)
 *   4d. Create LoggerService instance (using IConfig)
 *   4e. Create UserService instance (using IDatabase, ILogger)
 *   4f. Create UserController instance (using UserService, LoggerService)
 *     ↓
 * Step 5: Return UserController instance
 * ```
 * 
 * **Caching Based on Scope:**
 * 
 * - **Singleton**: Cache globally, return same instance always
 * - **Transient**: Never cache, create new instance every time
 * - **Scoped**: Cache per scope (per request), return same instance within scope
 * 
 * ## Error Scenarios and Debugging
 * 
 * The DI container throws `DependencyResolutionError` in these cases:
 * 
 * ### 1. Unregistered Service
 * 
 * ```typescript
 * // ServiceA is not registered
 * provider.getService(ServiceA);
 * 
 * // Error:
 * // DependencyResolutionError: Service 'ServiceA' is not registered
 * // Dependency Graph:
 * //   ServiceA (UNREGISTERED)
 * ```
 * 
 * ### 2. Circular Dependency
 * 
 * ```typescript
 * // ServiceA depends on ServiceB
 * // ServiceB depends on ServiceA
 * 
 * provider.getService(ServiceA);
 * 
 * // Error:
 * // DependencyResolutionError: Circular dependency detected
 * // Dependency Graph:
 * //   ServiceA
 * //   └─ ServiceB
 * //      └─ ServiceA (CIRCULAR!)
 * ```
 * 
 * **Solution:** Use property injection or redesign dependencies
 * 
 * ### 3. Missing Constructor Dependencies
 * 
 * ```typescript
 * class ServiceA {
 *   constructor(
 *     @Inject(ServiceB) private b: ServiceB,
 *     @Inject(ServiceC) private c: ServiceC  // ServiceC not registered
 *   ) {}
 * }
 * 
 * provider.getService(ServiceA);
 * 
 * // Error:
 * // DependencyResolutionError: Cannot resolve ServiceA
 * // Dependency Graph:
 * //   ServiceA
 * //   ├─ ServiceB (OK)
 * //   └─ ServiceC (UNREGISTERED)
 * ```
 * 
 * ### 4. Scope Mismatch
 * 
 * ```typescript
 * // ❌ BAD: Singleton depends on Scoped service
 * @Injectable({ scope: ServiceScope.Singleton })
 * class SingletonService {
 *   constructor(
 *     @Inject(ScopedService) private scoped: ScopedService  // ERROR!
 *   ) {}
 * }
 * 
 * // Error:
 * // DependencyResolutionError: Scope mismatch
 * // Cannot inject Scoped service into Singleton
 * // Dependency Graph:
 * //   SingletonService (Singleton)
 * //   └─ ScopedService (Scoped) ← INVALID!
 * ```
 * 
 * **Valid Scope Dependencies:**
 * - ✅ Singleton can inject: Singleton
 * - ✅ Scoped can inject: Singleton, Scoped
 * - ✅ Transient can inject: Singleton, Scoped, Transient
 * 
 * **Invalid Scope Dependencies:**
 * - ❌ Singleton cannot inject: Scoped, Transient
 * - ❌ Scoped cannot inject: Transient (usually)
 * 
 * @see {@link https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection | ASP.NET Core DI}
 * @see {@link https://martinfowler.com/articles/injection.html | Dependency Injection Pattern}
 * @version 1.0.0
 */

/**
 * Enum representing the lifecycle scopes for services in the DI container.
 * 
 * @remarks
 * **Lifecycle Scope Principles:**
 * 
 * The choice of scope affects:
 * 1. **Performance**: Singleton is fastest (no allocation), Transient is slowest
 * 2. **Memory**: Singleton uses least memory (one instance), Transient uses most
 * 3. **State Management**: Only Scoped and Transient can hold request-specific state
 * 4. **Thread Safety**: Singleton must be thread-safe (async-safe)
 * 
 * **Decision Matrix:**
 * 
 * | Service Type | Scope | Reason |
 * |--------------|-------|--------|
 * | Configuration | Singleton | Immutable, shared across app |
 * | Logger Factory | Singleton | Stateless, creates loggers |
 * | Connection Pool | Singleton | Expensive, shared resource |
 * | Database Context | Scoped | One per request, transaction boundary |
 * | Unit of Work | Scoped | One per request, atomic operations |
 * | Request Logger | Scoped | Contains trace ID from context |
 * | Command Handler | Transient | Isolated per execution |
 * | DTO Mapper | Transient | Stateless, isolated |
 * 
 * **Integration with RequestContext:**
 * 
 * Scoped services are intrinsically tied to `RequestContext`:
 * 
 * ```typescript
 * // When you create a scope:
 * const scope = provider.createScope();
 * 
 * // Internally:
 * // 1. Gets current RequestContext from AsyncLocalStorage
 * // 2. Creates a scope-specific service cache
 * // 3. Ties cache lifetime to the RequestContext scope
 * // 4. When context ends, cache is cleared
 * ```
 * 
 * **Best Practices:**
 * 
 * 1. **Default to Scoped**: When in doubt, use Scoped (safest)
 * 2. **Singleton for Shared State**: Only if truly application-wide
 * 3. **Transient for Isolation**: Only if you need guaranteed new instance
 * 4. **Never Mix Scopes Incorrectly**: Follow the dependency rules
 * 
 * @example Lifecycle comparison
 * ```typescript
 * // Singleton - one instance for entire app
 * @Injectable({ scope: ServiceScope.Singleton })
 * class ConfigService {
 *   private config = loadConfig();  // Loaded once
 *   
 *   getConfig() {
 *     return this.config;  // Always same config object
 *   }
 * }
 * 
 * // Transient - new instance every time
 * @Injectable({ scope: ServiceScope.Transient })
 * class CommandHandler {
 *   execute(command: Command) {
 *     // Each command gets fresh handler
 *     // No shared state between executions
 *   }
 * }
 * 
 * // Scoped - one instance per request
 * @Injectable({ scope: ServiceScope.Scoped })
 * class DatabaseContext {
 *   private transaction: Transaction;
 *   
 *   constructor() {
 *     // Created once per request
 *     this.transaction = beginTransaction();
 *   }
 *   
 *   async commit() {
 *     await this.transaction.commit();
 *   }
 * }
 * ```
 * 
 * @example Scope with RequestContext
 * ```typescript
 * app.use((req, res, next) => {
 *   // Create request context
 *   RequestContext.run({ traceId: req.headers['x-trace-id'] }, async () => {
 *     // Create DI scope (tied to this RequestContext)
 *     const scope = serviceProvider.createScope();
 *     
 *     try {
 *       // Get scoped services
 *       const dbContext = scope.getServiceProvider().getService(DatabaseContext);
 *       const logger = scope.getServiceProvider().getService(RequestLogger);
 *       
 *       // Logger has access to RequestContext.current()
 *       logger.info('Processing request');  // Includes traceId automatically
 *       
 *       // Process request
 *       await handleRequest(req, res, dbContext);
 *       
 *       // Commit transaction
 *       await dbContext.commit();
 *     } finally {
 *       // Dispose scope (cleanup all scoped services)
 *       scope.dispose();
 *     }
 *   });
 * });
 * ```
 */
export enum ServiceScope {
  /**
   * Singleton: A single instance shared across the entire application.
   * 
   * @remarks
   * **When Created:** First time service is requested
   * **When Destroyed:** Application shutdown (never during runtime)
   * **Shared Across:** All requests, all scopes, all users
   * **Thread Safety:** MUST be thread-safe (async-safe in Node.js)
   * 
   * **Memory Impact:** Minimal (one instance)
   * **Performance Impact:** Best (no allocation overhead)
   * 
   * **⚠️ Critical Warning:**
   * 
   * Never store request-specific state in singletons:
   * 
   * ```typescript
   * // ❌ VERY BAD - Race condition!
   * @Injectable({ scope: ServiceScope.Singleton })
   * class BadService {
   *   private currentUserId: string;  // ← DANGER! Shared across all requests
   *   
   *   setUser(userId: string) {
   *     this.currentUserId = userId;  // Request A's user overwrites Request B's!
   *   }
   * }
   * 
   * // ✅ GOOD - Use RequestContext instead
   * @Injectable({ scope: ServiceScope.Singleton })
   * class GoodService {
   *   getCurrentUserId(): string | undefined {
   *     return RequestContext.current()?.get('userId');  // Request-isolated
   *   }
   * }
   * ```
   */
  Singleton = 'singleton',
  
  /**
   * Transient: A new instance created every time the service is resolved.
   * 
   * @remarks
   * **When Created:** Every call to `getService()`
   * **When Destroyed:** Garbage collected when references dropped
   * **Shared Across:** Nothing (always unique)
   * **Thread Safety:** Not required (instance is isolated)
   * 
   * **Memory Impact:** High (many instances)
   * **Performance Impact:** Worst (allocation overhead)
   * 
   * **Use Sparingly:**
   * 
   * Transient is the safest but least efficient scope. Use only when:
   * - Service must be completely isolated
   * - Service holds temporary state that must not leak
   * - You're following Command pattern (one handler per command)
   * 
   * **Performance Considerations:**
   * 
   * ```typescript
   * // If you resolve transient service 1000 times:
   * for (let i = 0; i < 1000; i++) {
   *   const service = provider.getService(TransientService);  // 1000 instances created!
   * }
   * 
   * // Consider caching manually:
   * const service = provider.getService(TransientService);  // Create once
   * for (let i = 0; i < 1000; i++) {
   *   service.doWork();  // Reuse instance
   * }
   * ```
   */
  Transient = 'transient',
  
  /**
   * Scoped: An instance per request or scope, tied to AsyncLocalStorage for context awareness.
   * 
   * @remarks
   * **When Created:** First time service is requested within a scope
   * **When Destroyed:** When scope is disposed (end of request)
   * **Shared Across:** All resolutions within the same scope
   * **Thread Safety:** Not required (scope is request-isolated)
   * 
   * **Memory Impact:** Medium (one instance per request)
   * **Performance Impact:** Good (one allocation per request)
   * 
   * **Critical: Integration with RequestContext**
   * 
   * Scoped services are fundamentally tied to `RequestContext`:
   * 
   * ```typescript
   * // Scope creation
   * const scope = provider.createScope();
   * 
   * // Internally:
   * class ServiceScope {
   *   private scopedInstances = new Map<ServiceType, any>();
   *   
   *   createScope(): IServiceScope {
   *     // Get current RequestContext
   *     const ctx = RequestContext.current();
   *     if (!ctx) {
   *       throw new Error('Scoped services require an active RequestContext');
   *     }
   *     
   *     // Create scope tied to this context
   *     const scope = new ScopeImpl(this, ctx);
   *     
   *     // Register cleanup on context cancellation
   *     ctx.onCancel(() => {
   *       scope.dispose();
   *     });
   *     
   *     return scope;
   *   }
   * }
   * ```
   * 
   * **Automatic Cleanup:**
   * 
   * When `RequestContext` is cancelled or ends:
   * 1. All scoped services in that scope are disposed
   * 2. Services implementing `IDisposable` have `dispose()` called
   * 3. Resources (DB connections, file handles) are released
   * 
   * **Perfect for Unit of Work Pattern:**
   * 
   * ```typescript
   * @Injectable({ scope: ServiceScope.Scoped })
   * class UnitOfWork implements IUnitOfWork, IDisposable {
   *   private transaction: Transaction;
   *   
   *   constructor(@Inject(IDatabase) private db: IDatabase) {
   *     this.transaction = this.db.beginTransaction();
   *   }
   *   
   *   async commit() {
   *     await this.transaction.commit();
   *   }
   *   
   *   async rollback() {
   *     await this.transaction.rollback();
   *   }
   *   
   *   dispose() {
   *     // Called automatically when scope ends
   *     if (this.transaction.isActive()) {
   *       this.transaction.rollback();  // Cleanup uncommitted transaction
   *     }
   *   }
   * }
   * 
   * // Usage in HTTP handler:
   * app.post('/api/orders', async (req, res) => {
   *   RequestContext.run({ traceId: generateId() }, async () => {
   *     const scope = provider.createScope();
   *     
   *     try {
   *       const uow = scope.getServiceProvider().getService(UnitOfWork);
   *       const orderService = scope.getServiceProvider().getService(OrderService);
   *       
   *       await orderService.createOrder(req.body);
   *       await uow.commit();
   *       
   *       res.json({ success: true });
   *     } catch (error) {
   *       // uow.dispose() called automatically via scope.dispose()
   *       // Transaction rolled back automatically
   *       res.status(500).json({ error: 'Failed to create order' });
   *     } finally {
   *       scope.dispose();  // Triggers UnitOfWork.dispose()
   *     }
   *   });
   * });
   * ```
   */
  Scoped = 'scoped',
}

/**
 * Custom error class for dependency resolution failures.
 * 
 * @remarks
 * **Error Context and Debugging:**
 * 
 * `DependencyResolutionError` provides rich debugging information:
 * 
 * 1. **Error Message**: Human-readable description of what went wrong
 * 2. **Dependency Graph**: Visual tree showing the resolution path
 * 3. **Stack Trace**: Standard JavaScript stack trace
 * 
 * **Dependency Graph Format:**
 * 
 * The dependency graph is a tree structure showing the resolution path:
 * 
 * ```
 * ServiceA
 * ├─ ServiceB (OK)
 * │  ├─ ServiceD (OK)
 * │  └─ ServiceE (OK)
 * └─ ServiceC (UNREGISTERED) ← Root cause
 * ```
 * 
 * **Graph Symbols:**
 * - `├─` or `└─`: Dependency relationship
 * - `(OK)`: Service was successfully resolved
 * - `(UNREGISTERED)`: Service is not registered in container
 * - `(CIRCULAR!)`: Circular dependency detected
 * - `(SCOPE MISMATCH)`: Invalid scope dependency (e.g., Singleton → Scoped)
 * 
 * **Error Recovery Strategies:**
 * 
 * When you catch `DependencyResolutionError`:
 * 
 * 1. **Unregistered Service**: Register the missing service
 * 2. **Circular Dependency**: Refactor to break the cycle
 * 3. **Scope Mismatch**: Adjust service scopes or use property injection
 * 4. **Missing Decorator**: Add `@Injectable()` to the service class
 * 
 * @example Catching and logging resolution errors
 * ```typescript
 * try {
 *   const service = provider.getService(MyService);
 * } catch (error) {
 *   if (error instanceof DependencyResolutionError) {
 *     console.error('❌ Failed to resolve MyService');
 *     console.error('Error:', error.message);
 *     console.error('\nDependency Graph:');
 *     console.error(error.dependencyGraph);
 *     console.error('\nStack Trace:');
 *     console.error(error.stack);
 *     
 *     // Log to monitoring service
 *     logger.error('DI resolution failed', {
 *       service: 'MyService',
 *       graph: error.dependencyGraph,
 *       message: error.message,
 *     });
 *   }
 *   throw error;
 * }
 * ```
 * 
 * @example Detailed error message examples
 * ```typescript
 * // Example 1: Unregistered service
 * // Message: "Service 'LoggerService' is not registered in the container"
 * // Graph:
 * //   UserController
 * //   ├─ UserService (OK)
 * //   └─ LoggerService (UNREGISTERED)
 * 
 * // Example 2: Circular dependency
 * // Message: "Circular dependency detected: ServiceA -> ServiceB -> ServiceA"
 * // Graph:
 * //   ServiceA
 * //   └─ ServiceB
 * //      └─ ServiceA (CIRCULAR!)
 * 
 * // Example 3: Scope mismatch
 * // Message: "Scope mismatch: Singleton service 'CacheService' cannot depend on Scoped service 'DatabaseContext'"
 * // Graph:
 * //   CacheService (Singleton)
 * //   └─ DatabaseContext (Scoped) ← SCOPE MISMATCH
 * ```
 */
export class DependencyResolutionError extends Error {
  /**
   * A string representation of the dependency graph leading to the failure.
   * 
   * @remarks
   * **Graph Construction:**
   * 
   * The dependency graph is built during resolution:
   * 
   * ```typescript
   * class DependencyResolver {
   *   private resolutionStack: string[] = [];
   *   
   *   resolve<T>(serviceType: ServiceType<T>): T {
   *     // Add to stack
   *     this.resolutionStack.push(serviceType.name);
   *     
   *     try {
   *       // ... resolve dependencies
   *     } catch (error) {
   *       // Build graph from stack
   *       const graph = this.buildDependencyGraph(this.resolutionStack);
   *       throw new DependencyResolutionError(error.message, graph);
   *     }
   *   }
   *   
   *   private buildDependencyGraph(stack: string[]): string {
   *     let graph = '';
   *     for (let i = 0; i < stack.length; i++) {
   *       const indent = '  '.repeat(i);
   *       const branch = i === stack.length - 1 ? '└─' : '├─';
   *       graph += `${indent}${branch} ${stack[i]}\n`;
   *     }
   *     return graph;
   *   }
   * }
   * ```
   * 
   * **Usage in Error Messages:**
   * 
   * ```typescript
   * console.error('Dependency Resolution Failed');
   * console.error('-----------------------------');
   * console.error(error.dependencyGraph);
   * console.error('-----------------------------');
   * ```
   * 
   * Example output:
   * ```
   * Dependency Resolution Failed
   * -----------------------------
   * UserController
   * ├─ UserService
   * │  ├─ IDatabase (OK)
   * │  └─ ILogger
   * │     └─ IConfig (UNREGISTERED)
   * -----------------------------
   * ```
   */
  public readonly dependencyGraph: string;

  /**
   * Constructs a new DependencyResolutionError.
   * 
   * @param message - The error message describing the failure
   * @param dependencyGraph - Optional visual dependency graph for debugging
   * 
   * @remarks
   * **Error Message Guidelines:**
   * 
   * Good error messages should:
   * 1. State what service failed to resolve
   * 2. State why it failed (unregistered, circular, scope mismatch)
   * 3. Suggest a fix
   * 
   * **Example Messages:**
   * 
   * ```typescript
   * // Unregistered service
   * new DependencyResolutionError(
   *   "Service 'LoggerService' is not registered. " +
   *   "Did you forget to call services.addSingleton(LoggerService)?",
   *   graph
   * );
   * 
   * // Circular dependency
   * new DependencyResolutionError(
   *   "Circular dependency detected: ServiceA -> ServiceB -> ServiceA. " +
   *   "Consider using property injection to break the cycle.",
   *   graph
   * );
   * 
   * // Scope mismatch
   * new DependencyResolutionError(
   *   "Scope mismatch: Singleton 'CacheService' depends on Scoped 'DbContext'. " +
   *   "Change CacheService to Scoped or inject IDbContextFactory instead.",
   *   graph
   * );
   * ```
   * 
   * @example Creating error with context
   * ```typescript
   * class DependencyResolver {
   *   resolve<T>(serviceType: ServiceType<T>): T {
   *     try {
   *       return this.doResolve(serviceType);
   *     } catch (error) {
   *       const graph = this.buildGraph(this.resolutionStack);
   *       
   *       if (error instanceof UnregisteredServiceError) {
   *         throw new DependencyResolutionError(
   *           `Service '${serviceType.name}' is not registered in the container. ` +
   *           `Please register it using services.addSingleton() or services.addScoped().`,
   *           graph
   *         );
   *       }
   *       
   *       throw new DependencyResolutionError(
   *         `Failed to resolve '${serviceType.name}': ${error.message}`,
   *         graph
   *       );
   *     }
   *   }
   * }
   * ```
   */
  constructor(message: string, dependencyGraph: string = '') {
    super(message);
    this.name = 'DependencyResolutionError';
    this.dependencyGraph = dependencyGraph;
    
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DependencyResolutionError.prototype);
  }
}

/**
 * Interface for registering services in the DI container.
 * 
 * @remarks
 * **Configuration Phase:**
 * 
 * `IServiceCollection` is used during application startup to configure
 * the DI container. This is the "registration" phase:
 * 
 * ```
 * Application Lifecycle:
 * 
 * 1. Configuration Phase (Startup)
 *    ├─ Create ServiceCollection
 *    ├─ Register services (addSingleton, addScoped, addTransient)
 *    └─ Build ServiceProvider
 * 
 * 2. Runtime Phase (Request Handling)
 *    ├─ Resolve services (getService)
 *    ├─ Execute business logic
 *    └─ Dispose scopes
 * 
 * 3. Shutdown Phase
 *    └─ Dispose ServiceProvider (cleanup singletons)
 * ```
 * 
 * **Fluent API Pattern:**
 * 
 * All registration methods return `this` for method chaining:
 * 
 * ```typescript
 * services
 *   .addSingleton(ConfigService)
 *   .addSingleton(ILogger, ConsoleLogger)
 *   .addScoped(IDatabase, PostgresDatabase)
 *   .addScoped(IUnitOfWork, PrismaUnitOfWork)
 *   .addTransient(CreateUserHandler)
 *   .addTransient(GetUserHandler);
 * ```
 * 
 * **Registration Patterns:**
 * 
 * 1. **Self-Registration** (Type implements itself):
 * 
 * ```typescript
 * services.addSingleton(ConfigService);
 * // Equivalent to:
 * services.addSingleton(ConfigService, ConfigService);
 * ```
 * 
 * 2. **Interface-to-Implementation** (Abstraction to concrete):
 * 
 * ```typescript
 * services.addScoped(IDatabase, PostgresDatabase);
 * // Resolving IDatabase returns PostgresDatabase instance
 * ```
 * 
 * 3. **Factory Registration** (For complex initialization):
 * 
 * ```typescript
 * // Not shown in interface, but common in implementations:
 * services.addSingletonFactory(IDatabase, (provider) => {
 *   const config = provider.getService(IConfig);
 *   return new PostgresDatabase(config.connectionString);
 * });
 * ```
 * 
 * **Best Practices:**
 * 
 * 1. **Register Abstractions**: Always register interfaces, not concrete classes
 * 2. **Group by Scope**: Register all singletons first, then scoped, then transient
 * 3. **Use Descriptive Names**: Comment complex registrations
 * 4. **Verify Registration**: Check for missing registrations during startup
 * 
 * @example Complete application startup
 * ```typescript
 * // 1. Create service collection
 * const services = new ServiceCollection();
 * 
 * // 2. Register infrastructure services (Singleton)
 * services
 *   .addSingleton(IConfig, EnvironmentConfig)
 *   .addSingleton(ILogger, ConsoleLogger)
 *   .addSingleton(IEventBus, InMemoryEventBus);
 * 
 * // 3. Register database services (Scoped - per request)
 * services
 *   .addScoped(IDatabase, PostgresDatabase)
 *   .addScoped(IUnitOfWork, PrismaUnitOfWork)
 *   .addScoped(IUserRepository, UserRepository)
 *   .addScoped(IOrderRepository, OrderRepository);
 * 
 * // 4. Register application services (Scoped)
 * services
 *   .addScoped(UserService)
 *   .addScoped(OrderService)
 *   .addScoped(PaymentService);
 * 
 * // 5. Register handlers (Transient - one per command/query)
 * services
 *   .addTransient(CreateUserHandler)
 *   .addTransient(GetUserByIdHandler)
 *   .addTransient(CreateOrderHandler);
 * 
 * // 6. Build provider
 * const provider = services.buildServiceProvider();
 * 
 * // 7. Use provider in application
 * app.use((req, res, next) => {
 *   RequestContext.run({ traceId: generateId() }, async () => {
 *     const scope = provider.createScope();
 *     try {
 *       req.services = scope.getServiceProvider();
 *       await next();
 *     } finally {
 *       scope.dispose();
 *     }
 *   });
 * });
 * ```
 */
export interface IServiceCollection {
  /**
   * Adds a singleton service to the collection.
   * 
   * @template T - Service type
   * @param serviceType - The type (class) of the service to register
   * @param implementationType - Optional implementation type if different from serviceType
   * @returns The IServiceCollection for chaining
   * 
   * @remarks
   * **Singleton Lifecycle:**
   * 
   * - Created: On first resolution
   * - Shared: Across entire application
   * - Destroyed: On application shutdown
   * 
   * **When to Use:**
   * 
   * Use Singleton for:
   * - Configuration services (immutable)
   * - Logging infrastructure (stateless)
   * - Connection pools (shared resource)
   * - Event buses (message routing)
   * 
   * **⚠️ Thread Safety Warning:**
   * 
   * Singletons must be async-safe. Avoid mutable state:
   * 
   * ```typescript
   * // ❌ BAD: Mutable state in singleton
   * @Injectable({ scope: ServiceScope.Singleton })
   * class BadCounterService {
   *   private count = 0;  // ← Shared across all requests!
   *   
   *   increment() {
   *     this.count++;  // Race condition!
   *   }
   * }
   * 
   * // ✅ GOOD: Stateless singleton
   * @Injectable({ scope: ServiceScope.Singleton })
   * class GoodCounterService {
   *   async getCount(): Promise<number> {
   *     return db.query('SELECT COUNT(*) FROM users');  // Stateless
   *   }
   * }
   * ```
   * 
   * @example Self-registration
   * ```typescript
   * @Injectable({ scope: ServiceScope.Singleton })
   * class ConfigService {
   *   private config = loadConfig();
   *   getConfig() { return this.config; }
   * }
   * 
   * services.addSingleton(ConfigService);
   * // Type = Implementation = ConfigService
   * ```
   * 
   * @example Interface-to-implementation
   * ```typescript
   * interface ILogger {
   *   info(message: string): void;
   *   error(message: string, error?: Error): void;
   * }
   * 
   * @Injectable({ scope: ServiceScope.Singleton })
   * class ConsoleLogger implements ILogger {
   *   info(message: string) { console.log(message); }
   *   error(message: string, error?: Error) { console.error(message, error); }
   * }
   * 
   * services.addSingleton(ILogger, ConsoleLogger);
   * // Resolving ILogger returns ConsoleLogger instance
   * ```
   */
  addSingleton<T>(
    serviceType: new (...args: any[]) => T,
    implementationType?: new (...args: any[]) => T
  ): this;

  /**
   * Adds a transient service to the collection.
   * 
   * @template T - Service type
   * @param serviceType - The type (class) of the service to register
   * @param implementationType - Optional implementation type if different from serviceType
   * @returns The IServiceCollection for chaining
   * 
   * @remarks
   * **Transient Lifecycle:**
   * 
   * - Created: Every time `getService()` is called
   * - Shared: Never (always unique instance)
   * - Destroyed: When garbage collected
   * 
   * **When to Use:**
   * 
   * Use Transient for:
   * - Command/Query handlers (isolated execution)
   * - Stateless utilities (validators, mappers)
   * - Short-lived operations
   * 
   * **Performance Consideration:**
   * 
   * Transient is the slowest scope due to allocation overhead:
   * 
   * ```typescript
   * // This creates 1000 instances!
   * for (let i = 0; i < 1000; i++) {
   *   const handler = provider.getService(MyHandler);
   *   await handler.execute(commands[i]);
   * }
   * 
   * // Better: Create once and reuse if possible
   * const handler = provider.getService(MyHandler);
   * for (let i = 0; i < 1000; i++) {
   *   await handler.execute(commands[i]);
   * }
   * ```
   * 
   * **When NOT to Use:**
   * 
   * Avoid Transient if:
   * - Service holds expensive resources (DB connections)
   * - Service initialization is costly
   * - You need to share state within a request
   * 
   * @example Command handler registration
   * ```typescript
   * @Injectable({ scope: ServiceScope.Transient })
   * class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
   *   constructor(
   *     @Inject(IUserRepository) private userRepo: IUserRepository,
   *     @Inject(IEventBus) private eventBus: IEventBus
   *   ) {}
   *   
   *   async execute(command: CreateUserCommand): Promise<void> {
   *     const user = new User(command.email, command.name);
   *     await this.userRepo.save(user);
   *     await this.eventBus.publish(new UserCreatedEvent(user));
   *   }
   * }
   * 
   * services.addTransient(CreateUserHandler);
   * 
   * // Each command gets fresh handler
   * const handler1 = provider.getService(CreateUserHandler);
   * const handler2 = provider.getService(CreateUserHandler);
   * console.log(handler1 === handler2);  // false
   * ```
   */
  addTransient<T>(
    serviceType: new (...args: any[]) => T,
    implementationType?: new (...args: any[]) => T
  ): this;

  /**
   * Adds a scoped service to the collection, tied to request context via AsyncLocalStorage.
   * 
   * @template T - Service type
   * @param serviceType - The type (class) of the service to register
   * @param implementationType - Optional implementation type if different from serviceType
   * @returns The IServiceCollection for chaining
   * 
   * @remarks
   * **Scoped Lifecycle:**
   * 
   * - Created: On first resolution within a scope
   * - Shared: Within the same scope (same request)
   * - Destroyed: When scope is disposed (end of request)
   * 
   * **Critical: Requires RequestContext**
   * 
   * Scoped services require an active `RequestContext`:
   * 
   * ```typescript
   * // ❌ Will throw error
   * const provider = services.buildServiceProvider();
   * const scope = provider.createScope();  // ERROR: No RequestContext!
   * 
   * // ✅ Correct usage
   * RequestContext.run({}, () => {
   *   const scope = provider.createScope();  // OK: Inside RequestContext
   *   // ... use scoped services
   *   scope.dispose();
   * });
   * ```
   * 
   * **When to Use:**
   * 
   * Use Scoped for:
   * - Database contexts (one transaction per request)
   * - Unit of Work (atomic operations)
   * - Request-specific loggers (with trace ID)
   * - User session state
   * 
   * **Automatic Cleanup:**
   * 
   * Scoped services implementing `IDisposable` are automatically disposed:
   * 
   * ```typescript
   * @Injectable({ scope: ServiceScope.Scoped })
   * class DatabaseContext implements IDisposable {
   *   private connection: Connection;
   *   
   *   constructor(@Inject(IConfig) config: IConfig) {
   *     this.connection = createConnection(config.dbUrl);
   *   }
   *   
   *   dispose() {
   *     this.connection.close();  // Called automatically!
   *   }
   * }
   * 
   * // Usage:
   * const scope = provider.createScope();
   * try {
   *   const db = scope.getServiceProvider().getService(DatabaseContext);
   *   await db.query('SELECT * FROM users');
   * } finally {
   *   scope.dispose();  // Calls db.dispose() automatically
   * }
   * ```
   * 
   * @example Unit of Work pattern
   * ```typescript
   * @Injectable({ scope: ServiceScope.Scoped })
   * class PrismaUnitOfWork implements IUnitOfWork, IDisposable {
   *   private transaction: Prisma.Transaction;
   *   private repositories = new Map<string, any>();
   *   
   *   constructor(@Inject(PrismaClient) private prisma: PrismaClient) {
   *     // Transaction started automatically
   *     this.transaction = this.prisma.$transaction();
   *   }
   *   
   *   getRepository<T>(repoType: new (...args: any[]) => T): T {
   *     if (!this.repositories.has(repoType.name)) {
   *       const repo = new repoType(this.transaction);
   *       this.repositories.set(repoType.name, repo);
   *     }
   *     return this.repositories.get(repoType.name);
   *   }
   *   
   *   async commit() {
   *     await this.transaction.commit();
   *   }
   *   
   *   async rollback() {
   *     await this.transaction.rollback();
   *   }
   *   
   *   dispose() {
   *     // Cleanup if transaction not committed
   *     if (this.transaction.isActive()) {
   *       this.transaction.rollback();
   *     }
   *   }
   * }
   * 
   * services.addScoped(IUnitOfWork, PrismaUnitOfWork);
   * 
   * // HTTP handler:
   * app.post('/api/orders', async (req, res) => {
   *   RequestContext.run({ traceId: generateId() }, async () => {
   *     const scope = provider.createScope();
   *     try {
   *       const uow = scope.getServiceProvider().getService(IUnitOfWork);
   *       const orderService = scope.getServiceProvider().getService(OrderService);
   *       
   *       await orderService.createOrder(req.body);
   *       await uow.commit();
   *       
   *       res.json({ success: true });
   *     } catch (error) {
   *       // Transaction automatically rolled back via dispose()
   *       res.status(500).json({ error: error.message });
   *     } finally {
   *       scope.dispose();  // Cleanup all scoped services
   *     }
   *   });
   * });
   * ```
   */
  addScoped<T>(
    serviceType: new (...args: any[]) => T,
    implementationType?: new (...args: any[]) => T
  ): this;

  /**
   * Builds and returns an IServiceProvider from the registered services.
   * 
   * @returns An IServiceProvider instance
   * 
   * @remarks
   * **Finalization:**
   * 
   * `buildServiceProvider()` marks the end of the configuration phase.
   * After calling this method:
   * 
   * - ✅ You can resolve services via `provider.getService()`
   * - ❌ You cannot add more services (collection is sealed)
   * 
   * **Singleton Creation:**
   * 
   * Singletons can be eagerly created during build:
   * 
   * ```typescript
   * const provider = services.buildServiceProvider({
   *   validateScopes: true,  // Check for scope mismatches
   *   validateOnBuild: true,  // Resolve all singletons immediately
   * });
   * ```
   * 
   * **Validation:**
   * 
   * Good implementations validate the service graph:
   * 
   * ```typescript
   * buildServiceProvider(): IServiceProvider {
   *   // 1. Check for circular dependencies
   *   this.detectCircularDependencies();
   *   
   *   // 2. Check for scope mismatches
   *   this.validateScopeRules();
   *   
   *   // 3. Check for missing dependencies
   *   this.validateAllDependenciesRegistered();
   *   
   *   // 4. Create provider
   *   return new ServiceProvider(this.registrations);
   * }
   * ```
   * 
   * **Best Practice: Build Once**
   * 
   * Build the provider once at application startup:
   * 
   * ```typescript
   * // ✅ GOOD: Build once
   * const services = new ServiceCollection();
   * // ... register services
   * const provider = services.buildServiceProvider();
   * 
   * // Use same provider throughout app lifetime
   * app.use((req, res) => {
   *   const scope = provider.createScope();
   *   // ...
   * });
   * 
   * // ❌ BAD: Building multiple times
   * app.use((req, res) => {
   *   const provider = services.buildServiceProvider();  // Expensive!
   *   // ...
   * });
   * ```
   * 
   * @example Complete setup
   * ```typescript
   * // Configure services
   * const services = new ServiceCollection();
   * 
   * services
   *   .addSingleton(IConfig, EnvironmentConfig)
   *   .addSingleton(ILogger, ConsoleLogger)
   *   .addScoped(IDatabase, PostgresDatabase)
   *   .addScoped(IUnitOfWork, PrismaUnitOfWork)
   *   .addTransient(CreateUserHandler);
   * 
   * // Build provider (validate and finalize)
   * const provider = services.buildServiceProvider();
   * 
   * // Export for use in application
   * export default provider;
   * ```
   */
  buildServiceProvider(): IDIServiceProvider;
}

/**
 * Interface for resolving services from the DI container.
 * 
 * @remarks
 * **Runtime Phase:**
 * 
 * `IServiceProvider` is used during request handling to resolve services.
 * This is the "resolution" phase:
 * 
 * ```
 * Request Flow:
 * 
 * 1. Request arrives
 * 2. Create RequestContext
 * 3. Create DI Scope (provider.createScope())
 * 4. Resolve services (scope.getServiceProvider().getService())
 * 5. Execute business logic
 * 6. Dispose scope
 * 7. End RequestContext
 * ```
 * 
 * **Resolution Algorithm:**
 * 
 * When you call `getService<T>(ServiceType)`:
 * 
 * ```
 * Step 1: Check cache based on scope
 *   - Singleton: Check global cache
 *   - Scoped: Check scope-specific cache
 *   - Transient: Skip cache
 * 
 * Step 2: If not cached, resolve dependencies
 *   2a. Get constructor parameters via reflection
 *   2b. Recursively resolve each dependency
 *   2c. Detect circular dependencies
 * 
 * Step 3: Create instance
 *   3a. Call constructor with resolved dependencies
 *   3b. Call property injectors if any
 * 
 * Step 4: Cache based on scope
 *   - Singleton: Cache globally
 *   - Scoped: Cache in current scope
 *   - Transient: Don't cache
 * 
 * Step 5: Return instance
 * ```
 * 
 * **Thread Safety (Async Safety):**
 * 
 * ServiceProvider is async-safe because:
 * - Singleton cache is shared but instances are immutable
 * - Scoped cache is isolated per RequestContext
 * - Transient instances are never cached
 * 
 * @example Basic service resolution
 * ```typescript
 * // Get the provider
 * const provider: IServiceProvider = services.buildServiceProvider();
 * 
 * // Resolve a singleton
 * const logger = provider.getService(ILogger);
 * const logger2 = provider.getService(ILogger);
 * console.log(logger === logger2);  // true (same instance)
 * 
 * // Resolve a transient
 * const handler1 = provider.getService(CreateUserHandler);
 * const handler2 = provider.getService(CreateUserHandler);
 * console.log(handler1 === handler2);  // false (different instances)
 * ```
 * 
 * @example Scoped service resolution
 * ```typescript
 * app.use((req, res, next) => {
 *   RequestContext.run({ traceId: generateId() }, async () => {
 *     const scope = provider.createScope();
 *     try {
 *       const scopedProvider = scope.getServiceProvider();
 *       
 *       // Resolve scoped services
 *       const db = scopedProvider.getService(IDatabase);
 *       const uow = scopedProvider.getService(IUnitOfWork);
 *       
 *       // Same instance within this scope
 *       const db2 = scopedProvider.getService(IDatabase);
 *       console.log(db === db2);  // true
 *       
 *       // Different scope = different instance
 *       const scope2 = provider.createScope();
 *       const db3 = scope2.getServiceProvider().getService(IDatabase);
 *       console.log(db === db3);  // false
 *     } finally {
 *       scope.dispose();
 *     }
 *   });
 * });
 * ```
 */
export interface IDIServiceProvider {
  /**
   * Resolves a service instance by its type.
   * 
   * @template T - Service type
   * @param serviceType - The type (class) of the service to resolve
   * @returns An instance of the service
   * @throws {DependencyResolutionError} If resolution fails (unregistered, circular, scope mismatch)
   * 
   * @remarks
   * **Resolution Process:**
   * 
   * ```typescript
   * // What happens when you call getService(UserController):
   * 
   * 1. Check if UserController is registered
   *    → If not, throw DependencyResolutionError
   * 
   * 2. Check scope cache (if Singleton or Scoped)
   *    → If cached, return cached instance
   * 
   * 3. Get UserController constructor parameters:
   *    UserController(@Inject(UserService) userService, @Inject(ILogger) logger)
   * 
   * 4. Recursively resolve dependencies:
   *    4a. Resolve UserService
   *        → Requires IDatabase, IEventBus
   *        → Resolve IDatabase
   *        → Resolve IEventBus
   *        → Create UserService
   *    4b. Resolve ILogger
   *        → Create ConsoleLogger
   * 
   * 5. Create UserController instance:
   *    new UserController(userService, logger)
   * 
   * 6. Cache based on scope
   * 
   * 7. Return instance
   * ```
   * 
   * **Error Scenarios:**
   * 
   * See {@link DependencyResolutionError} for detailed error information.
   * 
   * **Performance Considerations:**
   * 
   * - **Singleton**: O(1) after first resolution (cached)
   * - **Scoped**: O(1) after first resolution within scope (cached)
   * - **Transient**: O(n) always (n = dependency depth)
   * 
   * **Best Practice: Resolve at Request Boundary**
   * 
   * Resolve root services at the HTTP/gRPC entry point:
   * 
   * ```typescript
   * // ✅ GOOD: Resolve at boundary
   * app.post('/api/users', async (req, res) => {
   *   const scope = provider.createScope();
   *   try {
   *     const controller = scope.getServiceProvider().getService(UserController);
   *     const result = await controller.createUser(req.body);
   *     res.json(result);
   *   } finally {
   *     scope.dispose();
   *   }
   * });
   * 
   * // ❌ BAD: Resolving deep in business logic
   * class UserService {
   *   async createUser(data: CreateUserData) {
   *     const emailService = provider.getService(IEmailService);  // Bad!
   *     await emailService.sendWelcomeEmail(data.email);
   *   }
   * }
   * ```
   * 
   * Instead, inject dependencies in constructor:
   * 
   * ```typescript
   * // ✅ GOOD: Constructor injection
   * class UserService {
   *   constructor(@Inject(IEmailService) private emailService: IEmailService) {}
   *   
   *   async createUser(data: CreateUserData) {
   *     await this.emailService.sendWelcomeEmail(data.email);
   *   }
   * }
   * ```
   * 
   * @example Resolving singleton services
   * ```typescript
   * const logger = provider.getService(ILogger);
   * logger.info('Application started');
   * 
   * const config = provider.getService(IConfig);
   * console.log('Database URL:', config.databaseUrl);
   * ```
   * 
   * @example Resolving with error handling
   * ```typescript
   * try {
   *   const service = provider.getService(MyService);
   *   await service.doWork();
   * } catch (error) {
   *   if (error instanceof DependencyResolutionError) {
   *     console.error('Failed to resolve MyService');
   *     console.error('Reason:', error.message);
   *     console.error('Graph:\n', error.dependencyGraph);
   *     
   *     // Maybe service is not registered?
   *     // Check services.addScoped(MyService) was called
   *   }
   *   throw error;
   * }
   * ```
   */
  getService<T>(serviceType: new (...args: any[]) => T): T;

  /**
   * Creates a new scope for scoped services, typically per request.
   * 
   * @returns An IServiceScope instance to manage the scope
   * @throws {Error} If called outside a RequestContext (for scoped service support)
   * 
   * @remarks
   * **Scope Lifetime:**
   * 
   * A scope represents a unit of work (usually one request):
   * 
   * ```
   * Request Lifecycle:
   * 
   * 1. Request arrives
   * 2. Create RequestContext
   * 3. Create Scope ← You are here
   * 4. Resolve scoped services
   * 5. Execute business logic
   * 6. Dispose scope (cleanup)
   * 7. End RequestContext
   * ```
   * 
   * **Critical: Requires RequestContext**
   * 
   * You MUST be inside a `RequestContext.run()` scope:
   * 
   * ```typescript
   * // ❌ Will throw error
   * const scope = provider.createScope();
   * // Error: Scoped services require an active RequestContext
   * 
   * // ✅ Correct usage
   * RequestContext.run({}, () => {
   *   const scope = provider.createScope();  // OK
   * });
   * ```
   * 
   * **Scope Isolation:**
   * 
   * Each scope has its own cache of scoped instances:
   * 
   * ```typescript
   * RequestContext.run({}, () => {
   *   const scope1 = provider.createScope();
   *   const scope2 = provider.createScope();
   *   
   *   const db1 = scope1.getServiceProvider().getService(IDatabase);
   *   const db2 = scope2.getServiceProvider().getService(IDatabase);
   *   
   *   console.log(db1 === db2);  // false (different scopes)
   * });
   * ```
   * 
   * **Automatic Cleanup:**
   * 
   * Always dispose scopes in a finally block:
   * 
   * ```typescript
   * const scope = provider.createScope();
   * try {
   *   // Use scoped services
   * } finally {
   *   scope.dispose();  // Always cleanup!
   * }
   * ```
   * 
   * **Integration with RequestContext Cancellation:**
   * 
   * Scopes automatically register cleanup on context cancellation:
   * 
   * ```typescript
   * RequestContext.run({}, () => {
   *   const ctx = RequestContext.current();
   *   const scope = provider.createScope();
   *   
   *   // Internally:
   *   ctx.onCancel(() => {
   *     scope.dispose();  // Cleanup on cancellation
   *   });
   * });
   * ```
   * 
   * @example HTTP middleware integration
   * ```typescript
   * app.use((req, res, next) => {
   *   RequestContext.run({
   *     traceId: req.headers['x-trace-id'] || generateId(),
   *     userId: req.user?.id,
   *   }, async () => {
   *     const scope = provider.createScope();
   *     
   *     try {
   *       // Attach to request for access in routes
   *       req.services = scope.getServiceProvider();
   *       await next();
   *     } catch (error) {
   *       logger.error('Request failed', error);
   *       res.status(500).send('Internal Server Error');
   *     } finally {
   *       scope.dispose();
   *     }
   *   });
   * });
   * 
   * // In route handler:
   * app.post('/api/orders', async (req, res) => {
   *   const orderService = req.services.getService(OrderService);
   *   const result = await orderService.createOrder(req.body);
   *   res.json(result);
   * });
   * ```
   * 
   * @example Multiple scopes in one request (advanced)
   * ```typescript
   * app.post('/api/batch-import', async (req, res) => {
   *   RequestContext.run({}, async () => {
   *     const results = [];
   *     
   *     // Each item gets its own scope (own transaction)
   *     for (const item of req.body.items) {
   *       const scope = provider.createScope();
   *       try {
   *         const uow = scope.getServiceProvider().getService(IUnitOfWork);
   *         const importService = scope.getServiceProvider().getService(ImportService);
   *         
   *         await importService.importItem(item);
   *         await uow.commit();
   *         
   *         results.push({ item: item.id, success: true });
   *       } catch (error) {
   *         results.push({ item: item.id, success: false, error: error.message });
   *       } finally {
   *         scope.dispose();  // Cleanup this item's scope
   *       }
   *     }
   *     
   *     res.json({ results });
   *   });
   * });
   * ```
   */
  createScope(): IServiceScope;
}

/**
 * Interface for managing a scope in the DI container, particularly for scoped services.
 * 
 * @remarks
 * **Scope Management:**
 * 
 * `IServiceScope` manages the lifetime of scoped services within a single
 * request or unit of work. It:
 * 
 * 1. Provides a scoped `IServiceProvider`
 * 2. Caches scoped service instances
 * 3. Disposes of services when scope ends
 * 
 * **Disposal Pattern:**
 * 
 * Scopes implement the Disposable pattern:
 * 
 * ```typescript
 * interface IServiceScope {
 *   dispose(): void;  // Must be called to cleanup
 * }
 * ```
 * 
 * **Automatic Disposal of Services:**
 * 
 * When `scope.dispose()` is called:
 * 
 * ```
 * Step 1: Iterate over cached scoped instances
 * Step 2: For each instance implementing IDisposable:
 *   2a. Call instance.dispose()
 *   2b. Catch and log any errors (don't throw)
 * Step 3: Clear the scope cache
 * Step 4: Mark scope as disposed
 * ```
 * 
 * **IDisposable Interface:**
 * 
 * Services can implement `IDisposable` for cleanup:
 * 
 * ```typescript
 * interface IDisposable {
 *   dispose(): void | Promise<void>;
 * }
 * 
 * @Injectable({ scope: ServiceScope.Scoped })
 * class DatabaseContext implements IDisposable {
 *   private connection: Connection;
 *   
 *   dispose() {
 *     this.connection.close();
 *   }
 * }
 * ```
 * 
 * **Using Statement Pattern (Future):**
 * 
 * JavaScript doesn't have C#'s `using` statement, but you can use try-finally:
 * 
 * ```typescript
 * // C# equivalent:
 * // using (var scope = provider.CreateScope()) { ... }
 * 
 * // JavaScript/TypeScript:
 * const scope = provider.createScope();
 * try {
 *   // Use scoped services
 * } finally {
 *   scope.dispose();
 * }
 * ```
 * 
 * Future JavaScript may support explicit resource management:
 * 
 * ```typescript
 * // Proposed JavaScript syntax:
 * using scope = provider.createScope();
 * // Automatically disposed at end of block
 * ```
 * 
 * @example Basic scope usage
 * ```typescript
 * const scope = provider.createScope();
 * try {
 *   const userService = scope.getServiceProvider().getService(UserService);
 *   const result = await userService.createUser(data);
 *   return result;
 * } finally {
 *   scope.dispose();  // Cleanup
 * }
 * ```
 * 
 * @example Scope with Unit of Work
 * ```typescript
 * const scope = provider.createScope();
 * try {
 *   const uow = scope.getServiceProvider().getService(IUnitOfWork);
 *   const orderService = scope.getServiceProvider().getService(OrderService);
 *   
 *   // Business logic
 *   await orderService.createOrder(orderData);
 *   await orderService.sendConfirmationEmail();
 *   
 *   // Commit transaction
 *   await uow.commit();
 * } catch (error) {
 *   // Transaction automatically rolled back via uow.dispose()
 *   logger.error('Order creation failed', error);
 *   throw error;
 * } finally {
 *   scope.dispose();  // Calls uow.dispose()
 * }
 * ```
 * 
 * @example Nested scopes (advanced)
 * ```typescript
 * const outerScope = provider.createScope();
 * try {
 *   const outerService = outerScope.getServiceProvider().getService(OuterService);
 *   
 *   // Inner scope for isolated operation
 *   const innerScope = provider.createScope();
 *   try {
 *     const innerService = innerScope.getServiceProvider().getService(InnerService);
 *     await innerService.doWork();
 *   } finally {
 *     innerScope.dispose();  // Cleanup inner scope
 *   }
 *   
 *   // Continue with outer scope
 *   await outerService.finalizeWork();
 * } finally {
 *   outerScope.dispose();  // Cleanup outer scope
 * }
 * ```
 */
export interface IServiceScope {
  /**
   * Gets the IServiceProvider associated with this scope.
   * 
   * @returns The scoped IServiceProvider
   * 
   * @remarks
   * **Scoped Provider:**
   * 
   * The provider returned by this method:
   * - Shares singleton instances with root provider
   * - Has its own cache for scoped instances
   * - Creates new transient instances on each call
   * 
   * **Usage Pattern:**
   * 
   * ```typescript
   * const scope = provider.createScope();
   * const scopedProvider = scope.getServiceProvider();
   * 
   * // Resolve services from scoped provider
   * const service1 = scopedProvider.getService(MyService);
   * const service2 = scopedProvider.getService(MyService);
   * console.log(service1 === service2);  // true (if scoped)
   * ```
   * 
   * **Don't Mix Providers:**
   * 
   * Always use the scoped provider, not the root provider:
   * 
   * ```typescript
   * const scope = provider.createScope();
   * 
   * // ❌ BAD: Using root provider
   * const service1 = provider.getService(MyScopedService);  // Wrong scope!
   * 
   * // ✅ GOOD: Using scoped provider
   * const service2 = scope.getServiceProvider().getService(MyScopedService);
   * ```
   * 
   * @example Typical usage
   * ```typescript
   * const scope = provider.createScope();
   * try {
   *   const scopedProvider = scope.getServiceProvider();
   *   
   *   const db = scopedProvider.getService(IDatabase);
   *   const logger = scopedProvider.getService(ILogger);
   *   const uow = scopedProvider.getService(IUnitOfWork);
   *   
   *   // All services from same scope
   * } finally {
   *   scope.dispose();
   * }
   * ```
   */
  getServiceProvider(): IDIServiceProvider;

  /**
   * Disposes of the scope, releasing any scoped resources.
   * 
   * @remarks
   * **Disposal Process:**
   * 
   * When `dispose()` is called:
   * 
   * ```typescript
   * dispose(): void {
   *   // 1. Check if already disposed
   *   if (this.isDisposed) {
   *     return;
   *   }
   *   
   *   // 2. Mark as disposed
   *   this.isDisposed = true;
   *   
   *   // 3. Dispose all cached scoped instances
   *   for (const [type, instance] of this.scopedInstances) {
   *     if (typeof instance.dispose === 'function') {
   *       try {
   *         await instance.dispose();
   *       } catch (error) {
   *         logger.error(`Error disposing ${type.name}`, error);
   *       }
   *     }
   *   }
   *   
   *   // 4. Clear cache
   *   this.scopedInstances.clear();
   * }
   * ```
   * 
   * **Idempotency:**
   * 
   * Calling `dispose()` multiple times is safe:
   * 
   * ```typescript
   * const scope = provider.createScope();
   * scope.dispose();
   * scope.dispose();  // No-op, safe
   * scope.dispose();  // No-op, safe
   * ```
   * 
   * **Error Handling:**
   * 
   * Errors during disposal are caught and logged but don't throw:
   * 
   * ```typescript
   * class BadService implements IDisposable {
   *   dispose() {
   *     throw new Error('Oops');
   *   }
   * }
   * 
   * const scope = provider.createScope();
   * const bad = scope.getServiceProvider().getService(BadService);
   * scope.dispose();  // Logs error but doesn't throw
   * ```
   * 
   * **Always Call in Finally:**
   * 
   * Always dispose in a finally block to ensure cleanup:
   * 
   * ```typescript
   * // ✅ GOOD: Always disposes
   * const scope = provider.createScope();
   * try {
   *   await doWork(scope);
   * } finally {
   *   scope.dispose();  // Always called
   * }
   * 
   * // ❌ BAD: Might not dispose
   * const scope = provider.createScope();
   * await doWork(scope);
   * scope.dispose();  // Not called if doWork throws!
   * ```
   * 
   * @example Cleanup with error handling
   * ```typescript
   * const scope = provider.createScope();
   * try {
   *   const uow = scope.getServiceProvider().getService(IUnitOfWork);
   *   
   *   await uow.start();
   *   await processData();
   *   await uow.commit();
   * } catch (error) {
   *   logger.error('Processing failed', error);
   *   // uow.rollback() called automatically via dispose
   *   throw error;
   * } finally {
   *   scope.dispose();  // Cleanup all scoped services
   * }
   * ```
   */
  dispose(): void;
}

/**
 * Decorator to mark a class as injectable with a specific lifecycle scope.
 * 
 * @param options - Configuration options for the injectable service
 * @returns A class decorator
 * 
 * @remarks
 * **Metadata Reflection:**
 * 
 * The `@Injectable()` decorator uses TypeScript's metadata reflection:
 * 
 * ```typescript
 * import 'reflect-metadata';  // Required!
 * 
 * export function Injectable(options: { scope: ServiceScope }): ClassDecorator {
 *   return function (target: any) {
 *     // Store metadata on the class
 *     Reflect.defineMetadata('injectable:scope', options.scope, target);
 *     Reflect.defineMetadata('injectable:registered', true, target);
 *   };
 * }
 * ```
 * 
 * **Automatic Registration:**
 * 
 * Some DI frameworks support automatic registration:
 * 
 * ```typescript
 * // Scan all classes with @Injectable() decorator
 * const services = new ServiceCollection();
 * await services.registerFromDirectory('./src/services');
 * 
 * // Internally:
 * for (const classFile of serviceFiles) {
 *   const ServiceClass = await import(classFile);
 *   const scope = Reflect.getMetadata('injectable:scope', ServiceClass);
 *   
 *   if (scope === ServiceScope.Singleton) {
 *     services.addSingleton(ServiceClass);
 *   } else if (scope === ServiceScope.Scoped) {
 *     services.addScoped(ServiceClass);
 *   } else if (scope === ServiceScope.Transient) {
 *     services.addTransient(ServiceClass);
 *   }
 * }
 * ```
 * 
 * **Best Practices:**
 * 
 * 1. **Always Specify Scope**: Don't rely on defaults
 * 2. **Document Why**: Comment why you chose the scope
 * 3. **Consistent Style**: Use decorators consistently across codebase
 * 
 * @example Service classes with decorators
 * ```typescript
 * import { Injectable, ServiceScope } from '@struktos/core';
 * 
 * // Singleton service
 * @Injectable({ scope: ServiceScope.Singleton })
 * export class ConfigService {
 *   private config = loadConfig();
 *   
 *   getConfig() {
 *     return this.config;
 *   }
 * }
 * 
 * // Scoped service
 * @Injectable({ scope: ServiceScope.Scoped })
 * export class DatabaseContext implements IDisposable {
 *   private connection: Connection;
 *   
 *   constructor(@Inject(IConfig) config: IConfig) {
 *     this.connection = createConnection(config.dbUrl);
 *   }
 *   
 *   dispose() {
 *     this.connection.close();
 *   }
 * }
 * 
 * // Transient service
 * @Injectable({ scope: ServiceScope.Transient })
 * export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
 *   constructor(
 *     @Inject(IUserRepository) private userRepo: IUserRepository,
 *     @Inject(IEventBus) private eventBus: IEventBus
 *   ) {}
 *   
 *   async execute(command: CreateUserCommand): Promise<void> {
 *     // Handler logic
 *   }
 * }
 * ```
 * 
 * @example With tsconfig.json setup
 * ```json
 * {
 *   "compilerOptions": {
 *     "experimentalDecorators": true,
 *     "emitDecoratorMetadata": true
 *   }
 * }
 * ```
 */
export function Injectable(options: { scope: ServiceScope }): ClassDecorator {
  // Prefix with underscore to indicate intentionally unused (TypeScript convention)
  return function (_target: any) {
    // Implementation would use Reflect.defineMetadata
    // This is a placeholder for the interface documentation
    
    // In real implementation:
    // Reflect.defineMetadata('injectable:scope', options.scope, target);
    // Reflect.defineMetadata('injectable:registered', true, target);
    
    // For now, we just satisfy TypeScript's requirement for a ClassDecorator
    // The actual DI container implementation will handle registration
    void options; // Explicitly mark as intentionally unused
  };
}

/**
 * Decorator to inject a dependency into a constructor parameter or property.
 * 
 * @template T - Service type
 * @param serviceType - The type (class) of the service to inject
 * @returns A parameter or property decorator
 * 
 * @remarks
 * **Constructor Injection (Preferred):**
 * 
 * ```typescript
 * class UserService {
 *   constructor(
 *     @Inject(IDatabase) private db: IDatabase,
 *     @Inject(ILogger) private logger: ILogger
 *   ) {}
 * }
 * ```
 * 
 * **Property Injection (Breaking Circular Dependencies):**
 * 
 * ```typescript
 * @Injectable({ scope: ServiceScope.Singleton })
 * class ServiceA {
 *   @Inject(ServiceB)
 *   private serviceB!: ServiceB;  // Use ! for late initialization
 * }
 * ```
 * 
 * **Metadata Reflection:**
 * 
 * The `@Inject()` decorator stores metadata about injection points:
 * 
 * ```typescript
 * export function Inject<T>(serviceType: new (...args: any[]) => T): ParameterDecorator {
 *   return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
 *     // Get existing metadata
 *     const existingMetadata = Reflect.getMetadata('injectable:parameters', target) || [];
 *     
 *     // Add this parameter's metadata
 *     existingMetadata[parameterIndex] = serviceType;
 *     
 *     // Store metadata
 *     Reflect.defineMetadata('injectable:parameters', existingMetadata, target);
 *   };
 * }
 * ```
 * 
 * **Type Safety:**
 * 
 * The decorator ensures type safety at compile time:
 * 
 * ```typescript
 * class UserService {
 *   constructor(
 *     @Inject(ILogger) private logger: ILogger  // ✅ Type matches
 *   ) {}
 * }
 * 
 * class BadService {
 *   constructor(
 *     @Inject(ILogger) private logger: IDatabase  // ❌ TypeScript error!
 *   ) {}
 * }
 * ```
 * 
 * **Optional Dependencies:**
 * 
 * For optional dependencies, use property injection:
 * 
 * ```typescript
 * @Injectable({ scope: ServiceScope.Singleton })
 * class MyService {
 *   @Inject(IOptionalService)
 *   private optional?: IOptionalService;  // Marked as optional
 *   
 *   doWork() {
 *     if (this.optional) {
 *       this.optional.doSomething();
 *     }
 *   }
 * }
 * ```
 * 
 * @example Constructor injection
 * ```typescript
 * @Injectable({ scope: ServiceScope.Scoped })
 * class OrderService {
 *   constructor(
 *     @Inject(IDatabase) private db: IDatabase,
 *     @Inject(ILogger) private logger: ILogger,
 *     @Inject(IEventBus) private eventBus: IEventBus
 *   ) {}
 *   
 *   async createOrder(data: CreateOrderData): Promise<Order> {
 *     this.logger.info('Creating order');
 *     const order = await this.db.orders.create(data);
 *     await this.eventBus.publish(new OrderCreatedEvent(order));
 *     return order;
 *   }
 * }
 * ```
 * 
 * @example Property injection (circular dependency fix)
 * ```typescript
 * // ServiceA depends on ServiceB
 * // ServiceB depends on ServiceA
 * // → Circular dependency!
 * 
 * @Injectable({ scope: ServiceScope.Singleton })
 * class ServiceA {
 *   // Use property injection to break cycle
 *   @Inject(ServiceB)
 *   private serviceB!: ServiceB;
 *   
 *   doA() {
 *     this.serviceB.doB();
 *   }
 * }
 * 
 * @Injectable({ scope: ServiceScope.Singleton })
 * class ServiceB {
 *   // Constructor injection is fine
 *   constructor(@Inject(ServiceA) private serviceA: ServiceA) {}
 *   
 *   doB() {
 *     console.log('B');
 *   }
 * }
 * ```
 */
export function Inject<T>(
  serviceType: new (...args: any[]) => T
): ParameterDecorator | PropertyDecorator {
  return function (
    _target: any,
    _propertyKey?: string | symbol,
    _parameterIndex?: number
  ) {
    // Implementation uses Reflect.defineMetadata
    // This is a placeholder for the interface documentation
    
    // In real implementation:
    // if (typeof parameterIndex === 'number') {
    //   // Constructor parameter injection
    //   const params = Reflect.getMetadata('injectable:parameters', target) || [];
    //   params[parameterIndex] = serviceType;
    //   Reflect.defineMetadata('injectable:parameters', params, target);
    // } else {
    //   // Property injection
    //   Reflect.defineMetadata('injectable:property', serviceType, target, propertyKey!);
    // }
    
    // Explicitly mark as intentionally unused
    void serviceType;
  };
}

/**
 * Factory function type for creating service instances.
 * 
 * @template T - Service type
 * @param provider - The service provider for resolving dependencies
 * @returns An instance of the service or a promise resolving to an instance
 * 
 * @remarks
 * **Use Cases:**
 * 
 * Factory functions are useful when:
 * 1. Service initialization requires complex logic
 * 2. Service depends on runtime configuration
 * 3. Service needs conditional initialization based on environment
 * 
 * @example Conditional service creation
 * ```typescript
 * services.addSingletonFactory(IDatabase, (provider) => {
 *   const config = provider.getService(IConfig);
 *   
 *   if (config.usePostgres) {
 *     return new PostgresDatabase(config.postgresUrl);
 *   } else {
 *     return new MySqlDatabase(config.mysqlUrl);
 *   }
 * });
 * ```
 * 
 * @example Async initialization
 * ```typescript
 * services.addSingletonFactory(IEmailService, async (provider) => {
 *   const config = provider.getService(IConfig);
 *   const service = new EmailService(config);
 *   await service.initialize();
 *   return service;
 * });
 * ```
 */
export type ServiceFactory<T> = (provider: IDIServiceProvider) => T | Promise<T>;

/**
 * Additional options for service registration.
 * 
 * @remarks
 * **Purpose:**
 * 
 * Provides additional metadata and control over service registration:
 * - Named registrations for multiple implementations
 * - Tags for service discovery
 * - Conditional registration (tryAdd, replace)
 * 
 * @example Named registration
 * ```typescript
 * services.addScoped(INotificationService, EmailNotificationService, {
 *   name: 'email'
 * });
 * services.addScoped(INotificationService, SmsNotificationService, {
 *   name: 'sms'
 * });
 * 
 * // Resolve by name
 * const emailService = provider.getService(INotificationService, 'email');
 * ```
 * 
 * @example Tagged services
 * ```typescript
 * services.addTransient(ICommandHandler, CreateUserHandler, {
 *   tags: ['command', 'user', 'write']
 * });
 * 
 * // Find all handlers with 'user' tag
 * const userHandlers = provider.getServicesByTag('user');
 * ```
 */
export interface ServiceRegistrationOptions {
  /**
   * Named registration for multiple implementations.
   * 
   * @example
   * ```typescript
   * services.addScoped(IRepository, UserRepository, { name: 'user' });
   * services.addScoped(IRepository, OrderRepository, { name: 'order' });
   * ```
   */
  name?: string;

  /**
   * Only register if service is not already registered.
   * 
   * @example
   * ```typescript
   * services.addSingleton(ILogger, ConsoleLogger, { tryAdd: true });
   * services.addSingleton(ILogger, FileLogger, { tryAdd: true }); // Skipped
   * ```
   */
  tryAdd?: boolean;

  /**
   * Replace existing registration if already registered.
   * 
   * @example
   * ```typescript
   * services.addSingleton(ICache, InMemoryCache);
   * services.addSingleton(ICache, RedisCache, { replace: true }); // Replaces
   * ```
   */
  replace?: boolean;

  /**
   * Metadata tags for filtering and discovery.
   * 
   * @example
   * ```typescript
   * services.addTransient(IHandler, MyHandler, {
   *   tags: ['command', 'critical']
   * });
   * ```
   */
  tags?: string[];

  /**
   * Custom metadata for application-specific purposes.
   * 
   * @example
   * ```typescript
   * services.addScoped(IService, MyService, {
   *   metadata: { version: '2.0', priority: 10 }
   * });
   * ```
   */
  metadata?: Record<string, any>;
}

/**
 * Descriptor for a registered service in the DI container.
 * 
 * @template T - Service type
 * 
 * @remarks
 * **Internal Representation:**
 * 
 * `ServiceDescriptor` is the internal representation of a registered service.
 * The DI container maintains a collection of descriptors.
 * 
 * **Use Cases:**
 * 
 * 1. **Service Discovery:**
 * 
 * ```typescript
 * const descriptors = services.getDescriptors();
 * const loggerDescriptor = descriptors.find(d => d.serviceType === ILogger);
 * console.log('Logger scope:', loggerDescriptor.scope);
 * ```
 * 
 * 2. **Validation:**
 * 
 * ```typescript
 * function validateServices(services: IServiceCollection) {
 *   const descriptors = services.getDescriptors();
 *   
 *   for (const descriptor of descriptors) {
 *     if (descriptor.scope === ServiceScope.Singleton) {
 *       // Validate singleton doesn't depend on scoped services
 *     }
 *   }
 * }
 * ```
 */
export interface ServiceDescriptor<T = any> {
  /**
   * The service type (interface or class) being registered.
   * 
   * @remarks
   * This is the "key" used when resolving services.
   */
  serviceType: new (...args: any[]) => T;

  /**
   * The implementation type (concrete class).
   * 
   * @remarks
   * Optional if factory is provided.
   */
  implementationType?: new (...args: any[]) => T;

  /**
   * The service lifecycle scope.
   */
  scope: ServiceScope;

  /**
   * Optional factory function for creating instances.
   * 
   * @remarks
   * If provided, factory is used instead of constructor injection.
   */
  factory?: ServiceFactory<T>;

  /**
   * Additional registration options.
   */
  options?: ServiceRegistrationOptions;
}

/**
 * ============================================================================
 * OPTIONAL: ADD THESE METHODS TO IServiceCollection INTERFACE
 * ============================================================================
 * 
 * Only add these if you want factory-based registration support:
 */

/*
// In IServiceCollection interface, add these methods:

addSingletonFactory<T>(
  serviceType: new (...args: any[]) => T,
  factory: ServiceFactory<T>,
  options?: ServiceRegistrationOptions
): this;

addScopedFactory<T>(
  serviceType: new (...args: any[]) => T,
  factory: ServiceFactory<T>,
  options?: ServiceRegistrationOptions
): this;

addTransientFactory<T>(
  serviceType: new (...args: any[]) => T,
  factory: ServiceFactory<T>,
  options?: ServiceRegistrationOptions
): this;

getDescriptors(): ServiceDescriptor[];

remove<T>(serviceType: new (...args: any[]) => T, name?: string): boolean;
*/