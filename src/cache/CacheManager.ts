// Temporary internal LRU implementation for POC
// In production, this would use @sukryu/aethel-ts
class SimpleLRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  
  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }
  
  put(key: K, value: V): void {
    // If key exists, delete it first
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add to end
    this.cache.set(key, value);
    
    // Evict least recently used if over capacity
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  
  get size(): number {
    return this.cache.size;
  }
}

/**
 * CacheManager - High-performance caching layer using Aethel.TS
 * 
 * This class provides a centralized caching interface that leverages
 * Aethel.TS's optimized LRUCache implementation for L1 in-memory caching.
 * Ideal for auth tokens, permissions, and frequently accessed data.
 * 
 * Note: This POC uses a simplified internal LRU implementation.
 * In production, this would use @sukryu/aethel-ts LRUCache for optimal performance.
 */
export class CacheManager<K = string, V = any> {
  private cache: SimpleLRUCache<K, V>;
  private capacity: number;
  
  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    // Initialize LRUCache with specified capacity
    // In production: this.cache = new LRUCache<K, V>(capacity);
    this.cache = new SimpleLRUCache<K, V>(capacity);
  }
  
  /**
   * Get a value from cache
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }
  
  /**
   * Set a value in cache
   */
  set(key: K, value: V): void {
    this.cache.put(key, value);
  }
  
  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.get(key) !== undefined;
  }
  
  /**
   * Delete a key from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache = new SimpleLRUCache<K, V>(this.capacity);
  }
  
  /**
   * Get cache statistics
   */
  stats(): { size: number; capacity: number } {
    return {
      size: this.cache.size,
      capacity: this.capacity
    };
  }
  
  /**
   * Get or set pattern - retrieves from cache or computes and caches
   */
  async getOrSet(
    key: K,
    factory: () => Promise<V> | V,
    ttl?: number
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await factory();
    this.set(key, value);
    
    // If TTL is specified, schedule deletion
    if (ttl && ttl > 0) {
      setTimeout(() => {
        this.delete(key);
      }, ttl);
    }
    
    return value;
  }
}

/**
 * Global cache manager instance for shared caching needs
 */
export const globalCache = new CacheManager(5000);

/**
 * Create a namespaced cache manager
 */
export function createCacheManager<K = string, V = any>(
  _namespace: string,
  capacity?: number
): CacheManager<K, V> {
  return new CacheManager<K, V>(capacity);
}