/**
 * @struktos/core - Request Context Implementation
 * 
 * AsyncLocalStorage-based context propagation inspired by Go's context package.
 * Automatically propagates context across async boundaries without manual passing.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { IContext, StruktosContextData } from './IContext';

/**
 * Internal store structure for context data
 */
interface ContextStore {
  data: Map<string, any>;
  cancelCallbacks: Set<() => void>;
  cancelled: boolean;
}

/**
 * RequestContext - AsyncLocalStorage-based implementation of IContext
 * 
 * This class uses Node.js AsyncLocalStorage to automatically propagate context
 * across asynchronous boundaries without manual passing.
 * 
 * @example
 * ```typescript
 * // Create a new context scope
 * RequestContext.run({ traceId: 'trace-123' }, async () => {
 *   // Context available in all async operations
 *   const ctx = RequestContext.current();
 *   console.log(ctx?.get('traceId')); // 'trace-123'
 * });
 * ```
 */
export class RequestContext<T extends StruktosContextData = StruktosContextData> implements IContext<T> {
  private static als = new AsyncLocalStorage<ContextStore>();
  private store: ContextStore;

  private constructor(store?: ContextStore) {
    this.store = store || {
      data: new Map(),
      cancelCallbacks: new Set(),
      cancelled: false,
    };
  }

  /**
   * Create a new context and run a function within its scope
   * All async operations within the callback will have access to this context
   * 
   * @param initialData - Initial context data
   * @param callback - Function to run within the context
   * @returns Result of the callback
   */
  static run<T extends StruktosContextData = StruktosContextData, R = any>(
    initialData: Partial<T>,
    callback: () => R
  ): R {
    const store: ContextStore = {
      data: new Map(Object.entries(initialData)),
      cancelCallbacks: new Set(),
      cancelled: false,
    };

    return RequestContext.als.run(store, callback);
  }

  /**
   * Run a function within the current context or create a new one
   * Useful for extending an existing context
   */
  static runWithContext<T extends StruktosContextData = StruktosContextData, R = any>(
    context: RequestContext<T>,
    callback: () => R
  ): R {
    return RequestContext.als.run(context.store, callback);
  }

  /**
   * Get the current context from AsyncLocalStorage
   * Returns undefined if no context is active
   */
  static current<T extends StruktosContextData = StruktosContextData>(): RequestContext<T> | undefined {
    const store = RequestContext.als.getStore();
    if (!store) {
      return undefined;
    }
    return new RequestContext<T>(store);
  }

  /**
   * Check if there's an active context
   */
  static hasContext(): boolean {
    return RequestContext.als.getStore() !== undefined;
  }

  // ==================== IContext Implementation ====================

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.store.data.get(key as string);
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.store.data.set(key as string, value);
  }

  has<K extends keyof T>(key: K): boolean {
    return this.store.data.has(key as string);
  }

  delete<K extends keyof T>(key: K): boolean {
    return this.store.data.delete(key as string);
  }

  isCancelled(): boolean {
    return this.store.cancelled;
  }

  onCancel(callback: () => void): void {
    if (this.store.cancelled) {
      // If already cancelled, invoke immediately
      try {
        callback();
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    } else {
      this.store.cancelCallbacks.add(callback);
    }
  }

  cancel(): void {
    if (this.store.cancelled) {
      return;
    }

    this.store.cancelled = true;

    // Invoke all registered callbacks
    for (const callback of this.store.cancelCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    }

    this.store.cancelCallbacks.clear();
  }

  getAll(): Readonly<Partial<T>> {
    const result: any = {};
    this.store.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Clone the current context with additional data
   */
  clone(additionalData?: Partial<T>): RequestContext<T> {
    const newStore: ContextStore = {
      data: new Map(this.store.data),
      cancelCallbacks: new Set(),
      cancelled: false,
    };

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        newStore.data.set(key, value);
      });
    }

    return new RequestContext<T>(newStore);
  }

  /**
   * Get the trace ID from context
   */
  get traceId(): string | undefined {
    return this.get('traceId' as keyof T) as string | undefined;
  }

  /**
   * Get the user ID from context
   */
  get userId(): string | undefined {
    return this.get('userId' as keyof T) as string | undefined;
  }
}

/**
 * Utility function to get current context or throw error
 * 
 * @throws Error if no context is active
 */
export function getCurrentContext<T extends StruktosContextData = StruktosContextData>(): RequestContext<T> {
  const context = RequestContext.current<T>();
  if (!context) {
    throw new Error('No active context. Make sure you are within a RequestContext.run() scope.');
  }
  return context;
}

/**
 * Utility function to safely get current context (returns null if none)
 */
export function tryGetCurrentContext<T extends StruktosContextData = StruktosContextData>(): RequestContext<T> | null {
  return RequestContext.current<T>() ?? null;
}

/**
 * Decorator for ensuring context exists in a method
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @RequireContext
 *   async getUser(id: string) {
 *     const ctx = RequestContext.current();
 *     // ctx is guaranteed to exist
 *   }
 * }
 * ```
 */
export function RequireContext(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    if (!RequestContext.hasContext()) {
      throw new Error(`Method requires an active RequestContext`);
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}