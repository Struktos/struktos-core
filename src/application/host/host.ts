/**
 * @struktos/core - Host Interface
 * 
 * ASP.NET Core-inspired hosting abstraction for Struktos platform.
 * Provides a unified way to configure and run applications.
 */

import { StruktosContextData } from '../../domain/context';
import { IAdapter, ServerInfo } from '../ports/adapter';

/**
 * Host configuration options
 */
export interface HostOptions {
  /** Application name */
  name?: string;

  /** Environment (development, production, test) */
  environment?: string;

  /** Enable graceful shutdown */
  gracefulShutdown?: boolean;

  /** Shutdown timeout in milliseconds */
  shutdownTimeout?: number;

  /** Enable health checks */
  healthChecks?: boolean;

  /** Custom logger */
  logger?: ILogger;
}

/**
 * Logger interface for host
 */
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Host lifecycle events
 */
export interface HostLifecycle {
  /** Called when host starts */
  onStart?(): Promise<void>;

  /** Called when host stops */
  onStop?(): Promise<void>;

  /** Called when an error occurs */
  onError?(error: Error): Promise<void>;
}

/**
 * Host status
 */
export type HostStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * IHost - Application host interface
 * 
 * The host is responsible for:
 * - Managing application lifecycle
 * - Coordinating multiple adapters
 * - Handling graceful shutdown
 * - Running background services
 * 
 * @example
 * ```typescript
 * const host = new StruktosHost({
 *   name: 'my-api',
 *   gracefulShutdown: true
 * });
 * 
 * host.addAdapter(expressAdapter);
 * host.addAdapter(grpcAdapter);
 * 
 * await host.start();
 * ```
 */
export interface IHost<T extends StruktosContextData = StruktosContextData> extends HostLifecycle {
  /**
   * Host name
   */
  readonly name: string;

  /**
   * Current status
   */
  readonly status: HostStatus;

  /**
   * Add an adapter to the host
   */
  addAdapter(adapter: IAdapter<T>): this;

  /**
   * Get all adapters
   */
  getAdapters(): IAdapter<T>[];

  /**
   * Start the host (starts all adapters)
   */
  start(): Promise<ServerInfo[]>;

  /**
   * Stop the host (stops all adapters)
   */
  stop(): Promise<void>;

  /**
   * Register a background service
   */
  addBackgroundService(service: IBackgroundService): this;

  /**
   * Get host options
   */
  getOptions(): HostOptions;
}

/**
 * Background service interface
 * Services that run in the background alongside the application
 */
export interface IBackgroundService {
  /** Service name */
  readonly name: string;

  /** Start the service */
  start(): Promise<void>;

  /** Stop the service */
  stop(): Promise<void>;

  /** Check if service is running */
  isRunning(): boolean;
}

/**
 * Abstract base class for background services
 */
export abstract class BackgroundServiceBase implements IBackgroundService {
  abstract readonly name: string;
  protected running = false;
  protected abortController: AbortController | null = null;

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.abortController = new AbortController();

    // Start the execution loop
    this.executeAsync(this.abortController.signal).catch((error) => {
      console.error(`[${this.name}] Service error:`, error);
      this.running = false;
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Implement this method to run the background task
   */
  protected abstract executeAsync(signal: AbortSignal): Promise<void>;

  /**
   * Helper for periodic tasks
   */
  protected async delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      });
    });
  }
}

/**
 * Interval-based background service
 */
export abstract class IntervalService extends BackgroundServiceBase {
  constructor(protected readonly intervalMs: number) {
    super();
  }

  protected async executeAsync(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.execute();
        await this.delay(this.intervalMs, signal);
      } catch (error) {
        if ((error as Error).message === 'Aborted') break;
        throw error;
      }
    }
  }

  /**
   * Implement this method for the periodic task
   */
  protected abstract execute(): Promise<void>;
}

/**
 * Default console logger
 */
export const consoleLogger: ILogger = {
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
  info: (message, ...args) => console.info(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
};

/**
 * StruktosHost - Default host implementation
 */
export class StruktosHost<T extends StruktosContextData = StruktosContextData> implements IHost<T> {
  readonly name: string;
  private _status: HostStatus = 'stopped';
  private adapters: IAdapter<T>[] = [];
  private backgroundServices: IBackgroundService[] = [];
  private logger: ILogger;

  constructor(private readonly options: HostOptions = {}) {
    this.name = options.name ?? 'struktos-app';
    this.logger = options.logger ?? consoleLogger;
  }

  get status(): HostStatus {
    return this._status;
  }

  addAdapter(adapter: IAdapter<T>): this {
    this.adapters.push(adapter);
    return this;
  }

  getAdapters(): IAdapter<T>[] {
    return [...this.adapters];
  }

  addBackgroundService(service: IBackgroundService): this {
    this.backgroundServices.push(service);
    return this;
  }

  getOptions(): HostOptions {
    return { ...this.options };
  }

  async start(): Promise<ServerInfo[]> {
    if (this._status !== 'stopped') {
      throw new Error(`Cannot start host in ${this._status} state`);
    }

    this._status = 'starting';
    this.logger.info(`Starting host: ${this.name}`);

    try {
      // Setup graceful shutdown
      if (this.options.gracefulShutdown !== false) {
        this.setupGracefulShutdown();
      }

      // Call onStart hook
      await this.onStart?.();

      // Start all adapters
      const serverInfos = await Promise.all(
        this.adapters.map(async (adapter) => {
          this.logger.info(`Starting adapter: ${adapter.name}`);
          return adapter.start();
        })
      );

      // Start background services
      await Promise.all(
        this.backgroundServices.map(async (service) => {
          this.logger.info(`Starting service: ${service.name}`);
          await service.start();
        })
      );

      this._status = 'running';
      this.logger.info(`Host ${this.name} started successfully`);

      return serverInfos;
    } catch (error) {
      this._status = 'error';
      await this.onError?.(error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this._status !== 'running') {
      return;
    }

    this._status = 'stopping';
    this.logger.info(`Stopping host: ${this.name}`);

    const timeout = this.options.shutdownTimeout ?? 30000;

    try {
      // Stop with timeout
      await Promise.race([
        this.performShutdown(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
        ),
      ]);

      await this.onStop?.();
      this._status = 'stopped';
      this.logger.info(`Host ${this.name} stopped successfully`);
    } catch (error) {
      this.logger.error(`Error during shutdown: ${(error as Error).message}`);
      this._status = 'error';
    }
  }

  private async performShutdown(): Promise<void> {
    // Stop background services first
    await Promise.all(
      this.backgroundServices.map(async (service) => {
        this.logger.info(`Stopping service: ${service.name}`);
        await service.stop();
      })
    );

    // Then stop adapters
    await Promise.all(
      this.adapters.map(async (adapter) => {
        this.logger.info(`Stopping adapter: ${adapter.name}`);
        await adapter.stop();
      })
    );
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  // Lifecycle hooks
  async onStart?(): Promise<void>;
  async onStop?(): Promise<void>;
  async onError?(error: Error): Promise<void>;
}

/**
 * Create a new host
 */
export function createHost<T extends StruktosContextData = StruktosContextData>(
  options?: HostOptions
): StruktosHost<T> {
  return new StruktosHost<T>(options);
}