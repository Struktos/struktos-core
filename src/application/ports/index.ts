/**
 * @struktos/core - Port Module
 * 
 * Application adapters
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
} from './adapter';