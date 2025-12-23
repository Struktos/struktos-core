/**
 * @struktos/core - Port Module
 *
 * Application adapters
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
} from './adapter';

export { AdapterBase } from './adapter';
