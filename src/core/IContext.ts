/**
 * IContext - Go-inspired Context interface for request lifecycle management
 * 
 * This interface provides a type-safe way to propagate request-scoped values,
 * cancellation signals, and timeouts through the application stack without
 * manually passing context objects through every function call.
 */
export interface IContext<T = any> {
  /**
   * Get a value from the context by key
   */
  get<K extends keyof T>(key: K): T[K] | undefined;
  
  /**
   * Set a value in the context
   */
  set<K extends keyof T>(key: K, value: T[K]): void;
  
  /**
   * Check if the context has been cancelled
   */
  isCancelled(): boolean;
  
  /**
   * Register a callback to be invoked when the context is cancelled
   */
  onCancel(callback: () => void): void;
  
  /**
   * Cancel the context and invoke all registered callbacks
   */
  cancel(): void;
  
  /**
   * Get all context data
   */
  getAll(): Readonly<Partial<T>>;
}

/**
 * Standard context keys used across struktos.js
 */
export interface StruktosContextData {
  traceId?: string;
  requestId?: string;
  userId?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Type alias for the standard struktos context
 */
export type StruktosContext = IContext<StruktosContextData>;