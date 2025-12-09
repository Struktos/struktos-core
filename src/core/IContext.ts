/**
 * @struktos/core - Context Interface
 * 
 * Go-inspired Context interface for request lifecycle management.
 * Provides type-safe way to propagate request-scoped values,
 * cancellation signals, and timeouts through the application stack.
 */

/**
 * IContext - Core context interface
 * 
 * @template T - Type of context data
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

  /**
   * Check if a key exists in context
   */
  has<K extends keyof T>(key: K): boolean;

  /**
   * Delete a key from context
   */
  delete<K extends keyof T>(key: K): boolean;
}

/**
 * Standard context keys used across Struktos.js
 */
export interface StruktosContextData {
  /** Unique trace ID for distributed tracing */
  traceId?: string;
  /** Request ID */
  requestId?: string;
  /** Authenticated user ID */
  userId?: string;
  /** Request start timestamp */
  timestamp?: number;
  /** HTTP method */
  method?: string;
  /** Request URL/path */
  url?: string;
  /** Client IP address */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Authenticated user object */
  user?: Record<string, any>;
  /** User roles */
  roles?: string[];
  /** Custom claims */
  claims?: Array<{ type: string; value: string }>;
  /** Allow additional properties */
  [key: string]: any;
}

/**
 * Type alias for the standard Struktos context
 */
export type StruktosContext = IContext<StruktosContextData>;