import { AsyncLocalStorage } from 'async_hooks';
import { IContext, StruktosContextData } from './IContext';

/**
 * RequestContext - AsyncLocalStorage-based implementation of IContext
 * 
 * This class uses Node.js AsyncLocalStorage to automatically propagate context
 * across asynchronous boundaries without manual passing. It's inspired by Go's
 * context package but adapted for JavaScript's event loop model.
 */
export class RequestContext<T extends StruktosContextData = StruktosContextData> implements IContext<T> {
  private static als = new AsyncLocalStorage<Map<string, any>>();
  private store: Map<string, any>;
  private cancelCallbacks: Set<() => void> = new Set();
  private cancelled = false;
  
  private constructor(initialData?: Partial<T>) {
    this.store = new Map();
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.store.set(key, value);
      });
    }
  }
  
  /**
   * Create a new context and run a function within its scope
   * All async operations within the callback will have access to this context
   */
  static run<T extends StruktosContextData = StruktosContextData, R = any>(
    initialData: Partial<T>,
    callback: () => R
  ): R {
    const context = new RequestContext<T>(initialData);
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
    
    const context = new RequestContext<T>();
    context.store = store;
    return context;
  }
  
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.store.get(key as string);
  }
  
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.store.set(key as string, value);
  }
  
  isCancelled(): boolean {
    return this.cancelled;
  }
  
  onCancel(callback: () => void): void {
    if (this.cancelled) {
      // If already cancelled, invoke immediately
      callback();
    } else {
      this.cancelCallbacks.add(callback);
    }
  }
  
  cancel(): void {
    if (this.cancelled) {
      return;
    }
    
    this.cancelled = true;
    
    // Invoke all registered callbacks
    this.cancelCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    });
    
    this.cancelCallbacks.clear();
  }
  
  getAll(): Readonly<Partial<T>> {
    const result: any = {};
    this.store.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

/**
 * Utility function to get current context or throw error
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