/**
 * @struktos/core - Adapter Interface
 * 
 * Adapter abstraction for integrating Struktos with different frameworks
 * and protocols (Express, Fastify, gRPC, Kafka, RabbitMQ, etc.)
 */

import { StruktosContextData } from '../core';
import { StruktosRequest, StruktosResponse, ProtocolType } from '../platform/types';
import { MiddlewareContext, IStruktosMiddleware } from '../platform/middleware';

/**
 * Adapter configuration options
 */
export interface AdapterOptions {
  /** Adapter name for identification */
  name?: string;

  /** Protocol type */
  protocol?: ProtocolType;

  /** Custom request transformer */
  requestTransformer?: (raw: any) => StruktosRequest;

  /** Custom response transformer */
  responseTransformer?: (response: StruktosResponse, raw: any) => void;

  /** Error handler */
  errorHandler?: (error: Error, raw: any) => void;

  /** Additional options */
  [key: string]: any;
}

/**
 * Adapter lifecycle hooks
 */
export interface AdapterLifecycle {
  /** Called when adapter is initialized */
  onInit?(): Promise<void>;

  /** Called before starting to listen */
  onBeforeStart?(): Promise<void>;

  /** Called after starting to listen */
  onAfterStart?(): Promise<void>;

  /** Called before stopping */
  onBeforeStop?(): Promise<void>;

  /** Called after stopping */
  onAfterStop?(): Promise<void>;
}

/**
 * Server information returned after starting
 */
export interface ServerInfo {
  /** Protocol (http, https, grpc, etc.) */
  protocol: string;

  /** Host address */
  host: string;

  /** Port number */
  port: number;

  /** Full URL */
  url: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * IAdapter - Framework/Protocol adapter interface
 * 
 * Adapters bridge Struktos with specific frameworks or protocols.
 * Each adapter is responsible for:
 * - Transforming framework-specific requests to StruktosRequest
 * - Transforming StruktosResponse to framework-specific responses
 * - Managing the framework's lifecycle
 * 
 * @example
 * ```typescript
 * class ExpressAdapter implements IAdapter {
 *   private app: Express;
 *   private server: Server | null = null;
 *   
 *   async start(port: number): Promise<ServerInfo> {
 *     return new Promise((resolve) => {
 *       this.server = this.app.listen(port, () => {
 *         resolve({
 *           protocol: 'http',
 *           host: 'localhost',
 *           port,
 *           url: `http://localhost:${port}`
 *         });
 *       });
 *     });
 *   }
 *   
 *   // ... other methods
 * }
 * ```
 */
export interface IAdapter<T extends StruktosContextData = StruktosContextData>
  extends AdapterLifecycle
{
  /**
   * Adapter name
   */
  readonly name: string;

  /**
   * Protocol type
   */
  readonly protocol: ProtocolType;

  /**
   * Initialize the adapter with middleware pipeline
   * 
   * @param middlewares - Array of middlewares to apply
   */
  init(middlewares: IStruktosMiddleware<T>[]): Promise<void>;

  /**
   * Start the adapter (begin listening for requests)
   * 
   * @param port - Port number (for HTTP-based protocols)
   * @param host - Host address
   * @returns Server information
   */
  start(port?: number, host?: string): Promise<ServerInfo>;

  /**
   * Stop the adapter (stop listening)
   */
  stop(): Promise<void>;

  /**
   * Check if adapter is running
   */
  isRunning(): boolean;

  /**
   * Get the underlying server/instance
   */
  getServer(): any;

  /**
   * Transform raw request to StruktosRequest
   */
  transformRequest(raw: any): StruktosRequest;

  /**
   * Transform StruktosResponse to raw response
   */
  transformResponse(response: StruktosResponse, raw: any): void;

  /**
   * Create middleware context from raw request/response
   */
  createContext(raw: any): MiddlewareContext<T>;
}

/**
 * Base adapter class with common functionality
 */
export abstract class AdapterBase<T extends StruktosContextData = StruktosContextData>
  implements IAdapter<T>
{
  abstract readonly name: string;
  abstract readonly protocol: ProtocolType;

  protected middlewares: IStruktosMiddleware<T>[] = [];
  protected running = false;
  protected options: AdapterOptions;

  constructor(options: AdapterOptions = {}) {
    this.options = options;
  }

  async init(middlewares: IStruktosMiddleware<T>[]): Promise<void> {
    this.middlewares = middlewares;
    await this.onInit?.();
  }

  abstract start(port?: number, host?: string): Promise<ServerInfo>;
  abstract stop(): Promise<void>;
  abstract getServer(): any;
  abstract transformRequest(raw: any): StruktosRequest;
  abstract transformResponse(response: StruktosResponse, raw: any): void;
  abstract createContext(raw: any): MiddlewareContext<T>;

  isRunning(): boolean {
    return this.running;
  }

  // Lifecycle hooks (can be overridden)
  async onInit?(): Promise<void>;
  async onBeforeStart?(): Promise<void>;
  async onAfterStart?(): Promise<void>;
  async onBeforeStop?(): Promise<void>;
  async onAfterStop?(): Promise<void>;

  /**
   * Execute middleware pipeline
   */
  protected async executePipeline(ctx: MiddlewareContext<T>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware.invoke(ctx, next);
      }
    };

    await next();
  }
}

// ==================== Adapter Types for Different Protocols ====================

/**
 * HTTP Adapter interface (Express, Fastify, Koa, etc.)
 */
export interface IHttpAdapter<T extends StruktosContextData = StruktosContextData>
  extends IAdapter<T>
{
  /**
   * Use a native middleware
   */
  useNativeMiddleware(middleware: any): void;

  /**
   * Register routes
   */
  registerRoutes(routes: any): void;

  /**
   * Get the native app instance
   */
  getNativeApp(): any;
}

/**
 * gRPC Adapter interface
 */
export interface IGrpcAdapter<T extends StruktosContextData = StruktosContextData>
  extends IAdapter<T>
{
  /**
   * Add a gRPC service
   */
  addService(service: any, implementation: any): void;

  /**
   * Get gRPC server credentials
   */
  getCredentials(): any;
}

/**
 * Message Queue Adapter interface (Kafka, RabbitMQ, etc.)
 */
export interface IMessageQueueAdapter<T extends StruktosContextData = StruktosContextData>
  extends IAdapter<T>
{
  /**
   * Subscribe to a topic/queue
   */
  subscribe(topic: string, handler: (message: any) => Promise<void>): Promise<void>;

  /**
   * Publish a message
   */
  publish(topic: string, message: any): Promise<void>;

  /**
   * Acknowledge a message
   */
  acknowledge(message: any): Promise<void>;
}

/**
 * WebSocket Adapter interface
 */
export interface IWebSocketAdapter<T extends StruktosContextData = StruktosContextData>
  extends IAdapter<T>
{
  /**
   * Handle new connection
   */
  onConnection(handler: (socket: any) => void): void;

  /**
   * Broadcast message to all clients
   */
  broadcast(message: any): void;

  /**
   * Send message to specific client
   */
  sendTo(clientId: string, message: any): void;
}

/**
 * Adapter factory function type
 */
export type AdapterFactory<T extends StruktosContextData = StruktosContextData> = (
  options?: AdapterOptions
) => IAdapter<T>;