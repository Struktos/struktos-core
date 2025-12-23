/**
 * @struktos/core - Struktos Application
 *
 * Main application class that serves as the entry point for Struktos applications.
 * Inspired by ASP.NET Core's WebApplication pattern.
 */

import { StruktosContextData } from '../../domain/context';
import {
  IStruktosMiddleware,
  MiddlewareFunction,
  createMiddleware,
  isMiddleware,
} from '../../infrastructure/platform/middleware';
import {
  IExceptionFilter,
  ExceptionFilterChain,
  DefaultExceptionFilter,
  ExceptionContext,
} from '../../domain/exceptions/exceptions';
import { IAdapter, ServerInfo } from '../ports/adapter';
import {
  IHost,
  StruktosHost,
  HostOptions,
  IBackgroundService,
  ILogger,
  consoleLogger,
} from './host';

/**
 * Application builder options
 */
export interface StruktosAppOptions extends HostOptions {
  /** Default port */
  port?: number;

  /** Default host */
  host?: string;

  /** Automatically add error handling middleware */
  useDefaultErrorHandler?: boolean;

  /** Include request timing */
  includeTimings?: boolean;
}

/**
 * StruktosApp - Main application class
 *
 * This is the primary entry point for Struktos applications.
 * It provides a fluent API for configuring middleware, exception filters,
 * and adapters.
 *
 * @example
 * ```typescript
 * const app = StruktosApp.create();
 *
 * // Add middleware
 * app.use(async (ctx, next) => {
 *   console.log(`${ctx.request.method} ${ctx.request.path}`);
 *   await next();
 * });
 *
 * // Add exception filter
 * app.useExceptionFilter(new ValidationExceptionFilter());
 *
 * // Start with adapter
 * await app.listen(expressAdapter, 3000);
 * ```
 */
export class StruktosApp<T extends StruktosContextData = StruktosContextData> {
  private middlewares: IStruktosMiddleware<T>[] = [];
  private exceptionFilters: ExceptionFilterChain = new ExceptionFilterChain();
  private adapters: IAdapter<T>[] = [];
  private backgroundServices: IBackgroundService[] = [];
  private host: IHost<T> | null = null;
  private logger: ILogger;

  private constructor(private readonly options: StruktosAppOptions = {}) {
    this.logger = options.logger ?? consoleLogger;

    // Add default exception filter
    if (options.useDefaultErrorHandler !== false) {
      this.exceptionFilters.addFilter(new DefaultExceptionFilter());
    }
  }

  /**
   * Create a new Struktos application
   */
  static create<T extends StruktosContextData = StruktosContextData>(
    options?: StruktosAppOptions,
  ): StruktosApp<T> {
    return new StruktosApp<T>(options);
  }

  // ==================== Middleware Configuration ====================

  /**
   * Add middleware to the pipeline
   *
   * @param middleware - Middleware instance or function
   */
  use(middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    if (isMiddleware(middleware)) {
      this.middlewares.push(middleware);
    } else {
      this.middlewares.push(createMiddleware(middleware));
    }
    return this;
  }

  /**
   * Add multiple middlewares
   */
  useMany(
    middlewares: Array<IStruktosMiddleware<T> | MiddlewareFunction<T>>,
  ): this {
    for (const middleware of middlewares) {
      this.use(middleware);
    }
    return this;
  }

  /**
   * Add middleware conditionally
   */
  useIf(
    condition: boolean | (() => boolean),
    middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>,
  ): this {
    const shouldUse = typeof condition === 'function' ? condition() : condition;
    if (shouldUse) {
      this.use(middleware);
    }
    return this;
  }

  /**
   * Add middleware for specific path prefix
   */
  useFor(
    pathPrefix: string,
    middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>,
  ): this {
    const wrappedMiddleware = createMiddleware<T>(async (ctx, next) => {
      if (ctx.request.path.startsWith(pathPrefix)) {
        const actualMiddleware = isMiddleware(middleware)
          ? middleware
          : createMiddleware(middleware);
        await actualMiddleware.invoke(ctx, next);
      } else {
        await next();
      }
    });
    this.middlewares.push(wrappedMiddleware);
    return this;
  }

  // ==================== Exception Handling ====================

  /**
   * Add an exception filter
   */
  useExceptionFilter(filter: IExceptionFilter<T>): this {
    this.exceptionFilters.addFilter(filter as IExceptionFilter);
    return this;
  }

  /**
   * Add multiple exception filters
   */
  useExceptionFilters(filters: IExceptionFilter<T>[]): this {
    for (const filter of filters) {
      this.useExceptionFilter(filter);
    }
    return this;
  }

  // ==================== Services ====================

  /**
   * Add a background service
   */
  addService(service: IBackgroundService): this {
    this.backgroundServices.push(service);
    return this;
  }

  // ==================== Adapter Management ====================

  /**
   * Add an adapter without starting it
   */
  addAdapter(adapter: IAdapter<T>): this {
    this.adapters.push(adapter);
    return this;
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): IAdapter<T>[] {
    return [...this.adapters];
  }

  // ==================== Application Lifecycle ====================

  /**
   * Start the application with a specific adapter
   *
   * @param adapter - Adapter to use (Express, Fastify, etc.)
   * @param port - Port number (optional, defaults to options.port or 3000)
   * @param host - Host address (optional, defaults to options.host or '0.0.0.0')
   */
  async listen(
    adapter: IAdapter<T>,
    port?: number,
    host?: string,
  ): Promise<ServerInfo> {
    const actualPort = port ?? this.options.port ?? 3000;
    const actualHost = host ?? this.options.host ?? '0.0.0.0';

    // Initialize adapter with middleware pipeline
    await adapter.init(this.buildPipeline());

    // Start adapter
    const serverInfo = await adapter.start(actualPort, actualHost);

    this.logger.info(`🚀 Struktos application started`);
    this.logger.info(
      `   ${serverInfo.protocol.toUpperCase()} server: ${serverInfo.url}`,
    );

    // Start background services
    for (const service of this.backgroundServices) {
      await service.start();
      this.logger.info(`   Background service: ${service.name}`);
    }

    return serverInfo;
  }

  /**
   * Start with multiple adapters using a host
   */
  async run(_port?: number): Promise<ServerInfo[]> {
    if (this.adapters.length === 0) {
      throw new Error(
        'No adapters registered. Use addAdapter() before calling run()',
      );
    }

    // Create host
    this.host = new StruktosHost<T>({
      name: this.options.name,
      environment: this.options.environment,
      gracefulShutdown: this.options.gracefulShutdown,
      shutdownTimeout: this.options.shutdownTimeout,
      logger: this.logger,
    });

    // Build pipeline
    const pipeline = this.buildPipeline();

    // Initialize and add adapters to host
    for (const adapter of this.adapters) {
      await adapter.init(pipeline);
      this.host.addAdapter(adapter);
    }

    // Add background services
    for (const service of this.backgroundServices) {
      this.host.addBackgroundService(service);
    }

    // Start host
    return this.host.start();
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    // Stop background services
    for (const service of this.backgroundServices) {
      await service.stop();
    }

    // Stop host if using run()
    if (this.host) {
      await this.host.stop();
    }

    // Stop individual adapters
    for (const adapter of this.adapters) {
      if (adapter.isRunning()) {
        await adapter.stop();
      }
    }

    this.logger.info('Application stopped');
  }

  // ==================== Pipeline Building ====================

  /**
   * Build the complete middleware pipeline including error handling
   */
  private buildPipeline(): IStruktosMiddleware<T>[] {
    const pipeline: IStruktosMiddleware<T>[] = [];

    // Add timing middleware if enabled
    if (this.options.includeTimings !== false) {
      pipeline.push(this.createTimingMiddleware());
    }

    // Add error handling wrapper
    pipeline.push(this.createErrorHandlingMiddleware());

    // Add user middlewares
    pipeline.push(...this.middlewares);

    return pipeline;
  }

  /**
   * Create timing middleware
   */
  private createTimingMiddleware(): IStruktosMiddleware<T> {
    return createMiddleware<T>(async (ctx, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      ctx.response.headers['X-Response-Time'] = `${duration}ms`;
    });
  }

  /**
   * Create error handling middleware that wraps the entire pipeline
   */
  private createErrorHandlingMiddleware(): IStruktosMiddleware<T> {
    return createMiddleware<T>(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        const exceptionContext: ExceptionContext<T> = {
          error: error as Error,
          context: ctx.context,
          path: ctx.request.path,
          method: ctx.request.method,
          timestamp: new Date(),
        };

        const response = await this.exceptionFilters.catch(
          exceptionContext as ExceptionContext,
        );

        ctx.response.status = response.status;
        ctx.response.headers = { ...ctx.response.headers, ...response.headers };
        ctx.response.body = response.body;
      }
    });
  }

  // ==================== Utility Methods ====================

  /**
   * Get application options
   */
  getOptions(): StruktosAppOptions {
    return { ...this.options };
  }

  /**
   * Get middleware count
   */
  get middlewareCount(): number {
    return this.middlewares.length;
  }

  /**
   * Check if application is running
   */
  isRunning(): boolean {
    return (
      this.adapters.some((a) => a.isRunning()) ||
      this.host?.status === 'running'
    );
  }
}

// ==================== Builder Pattern ====================

/**
 * StruktosAppBuilder - Fluent builder for StruktosApp
 */
export class StruktosAppBuilder<
  T extends StruktosContextData = StruktosContextData,
> {
  private options: StruktosAppOptions = {};
  private middlewares: Array<IStruktosMiddleware<T> | MiddlewareFunction<T>> =
    [];
  private filters: IExceptionFilter<T>[] = [];
  private services: IBackgroundService[] = [];

  /**
   * Set application name
   */
  withName(name: string): this {
    this.options.name = name;
    return this;
  }

  /**
   * Set default port
   */
  withPort(port: number): this {
    this.options.port = port;
    return this;
  }

  /**
   * Set environment
   */
  withEnvironment(env: string): this {
    this.options.environment = env;
    return this;
  }

  /**
   * Enable graceful shutdown
   */
  withGracefulShutdown(timeout?: number): this {
    this.options.gracefulShutdown = true;
    this.options.shutdownTimeout = timeout;
    return this;
  }

  /**
   * Set logger
   */
  withLogger(logger: ILogger): this {
    this.options.logger = logger;
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: IStruktosMiddleware<T> | MiddlewareFunction<T>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add exception filter
   */
  useExceptionFilter(filter: IExceptionFilter<T>): this {
    this.filters.push(filter);
    return this;
  }

  /**
   * Add background service
   */
  addService(service: IBackgroundService): this {
    this.services.push(service);
    return this;
  }

  /**
   * Build the application
   */
  build(): StruktosApp<T> {
    const app = StruktosApp.create<T>(this.options);

    for (const middleware of this.middlewares) {
      app.use(middleware);
    }

    for (const filter of this.filters) {
      app.useExceptionFilter(filter);
    }

    for (const service of this.services) {
      app.addService(service);
    }

    return app;
  }
}

/**
 * Create a new application builder
 */
export function createAppBuilder<
  T extends StruktosContextData = StruktosContextData,
>(): StruktosAppBuilder<T> {
  return new StruktosAppBuilder<T>();
}

// ==================== Convenience Exports ====================

/**
 * Quick start helper - creates and configures an app in one call
 */
export function createApp<T extends StruktosContextData = StruktosContextData>(
  options?: StruktosAppOptions,
): StruktosApp<T> {
  return StruktosApp.create<T>(options);
}
