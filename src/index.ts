/**
 * @struktos/core - Enterprise-grade Node.js infrastructure library
 * 
 * Provides Go-style context propagation, C#-inspired architecture patterns,
 * and high-performance caching powered by Aethel.TS.
 */

// Core Context System
export { IContext, StruktosContextData, StruktosContext } from './core/IContext';
export { RequestContext, getCurrentContext, tryGetCurrentContext } from './core/RequestContext';

// Cache Management
export { CacheManager, globalCache, createCacheManager } from './cache/CacheManager';

// Version info
export const VERSION = '0.1.0';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { RequestContext } from '@struktos/core';
 * 
 * // Initialize context for a request
 * RequestContext.run(
 *   { traceId: 'trace-123', userId: 'user-456' },
 *   async () => {
 *     // All async operations in this scope have access to context
 *     await businessLogic();
 *   }
 * );
 * 
 * // Anywhere in your code:
 * function businessLogic() {
 *   const context = RequestContext.current();
 *   const traceId = context?.get('traceId');
 *   // No manual context passing needed!
 * }
 * ```
 */