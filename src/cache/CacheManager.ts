/**
 * @struktos/core - Cache Manager
 * 
 * High-performance LRU cache with TTL support for enterprise applications.
 * Used for caching authentication tokens, permissions, and frequently accessed data.
 */

/**
 * Cache entry with value and metadata
 */
interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  capacity: number;
  hitRate: number;
}

/**
 * CacheManager - High-performance LRU cache with TTL
 * 
 * @template K - Key type
 * @template V - Value type
 * 
 * @example
 * ```typescript
 * const cache = new CacheManager<string, User>(1000);
 * 
 * // Cache with TTL
 * cache.set('user-123', user, 60000); // 60 seconds
 * 
 * // Get or set pattern
 * const user = await cache.getOrSet(
 *   'user-123',
 *   async () => await db.users.findById('user-123'),
 *   60000
 * );
 * ```
 */
export class CacheManager<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private hits = 0;
  private misses = 0;

  constructor(private readonly capacity: number = 1000) {}

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set(key: K, value: V, ttl?: number): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists in cache (and is not expired)
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      capacity: this.capacity,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get or set pattern - gets from cache or computes and caches
   * 
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param ttl - Time to live in milliseconds (optional)
   */
  async getOrSet(key: K, factory: () => V | Promise<V>, ttl?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Get or set synchronously
   */
  getOrSetSync(key: K, factory: () => V, ttl?: number): V {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Get all keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Update TTL for existing entry
   */
  touch(key: K, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + ttl;
    return true;
  }
}

/**
 * Global cache instance for convenience
 */
export const globalCache = new CacheManager<string, any>(10000);

/**
 * Create a new cache manager with specified capacity
 */
export function createCacheManager<K, V>(capacity: number = 1000): CacheManager<K, V> {
  return new CacheManager<K, V>(capacity);
}