/**
 * @struktos/core - Hosting Module
 *
 * Application hosting, adapters, and lifecycle management
 */

// Adapter
export {
  IAdapter,
  IHttpAdapter,
  IGrpcAdapter,
  IMessageQueueAdapter,
  IWebSocketAdapter,
  AdapterBase,
  AdapterOptions,
  AdapterLifecycle,
  AdapterFactory,
  ServerInfo,
} from '../ports/adapter';

// Host
export {
  IHost,
  IBackgroundService,
  ILogger,
  HostOptions,
  HostLifecycle,
  HostStatus,
  StruktosHost,
  BackgroundServiceBase,
  IntervalService,
  consoleLogger,
  createHost,
} from './host';

// Application
export {
  StruktosApp,
  StruktosAppOptions,
  StruktosAppBuilder,
  createApp,
  createAppBuilder,
} from './app';
