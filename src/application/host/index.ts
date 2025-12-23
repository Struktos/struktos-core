/**
 * @struktos/core - Hosting Module
 *
 * Application hosting, adapters, and lifecycle management
 */

// Adapter
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
} from '../ports/adapter';

export { AdapterBase } from '../ports/adapter';

// Host
export type {
  IHost,
  IBackgroundService,
  ILogger,
  HostOptions,
  HostLifecycle,
  HostStatus,
} from './host';

export {
  StruktosHost,
  BackgroundServiceBase,
  IntervalService,
  consoleLogger,
  createHost,
} from './host';

// Application
export {
  StruktosApp,
  StruktosAppBuilder,
  createApp,
  createAppBuilder,
} from './app';

export type { StruktosAppOptions } from './app';
