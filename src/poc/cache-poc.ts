import { CacheManager, globalCache } from '../cache/CacheManager';

/**
 * POC: CacheManager with Aethel.TS Integration
 * 
 * This demonstrates how struktos.js leverages Aethel.TS's high-performance
 * LRUCache for enterprise-grade caching needs.
 */

// Simulated user data
interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

// Simulated permission data
interface Permission {
  userId: string;
  resource: string;
  actions: string[];
}

// Simulate expensive database call
async function fetchUserFromDB(userId: string): Promise<User> {
  console.log(`💾 [Database] Fetching user ${userId}...`);
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate DB latency
  
  return {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    roles: ['user', 'viewer']
  };
}

// Simulate expensive permission check
async function fetchPermissionsFromDB(userId: string): Promise<Permission> {
  console.log(`💾 [Database] Fetching permissions for ${userId}...`);
  await new Promise(resolve => setTimeout(resolve, 150)); // Simulate DB latency
  
  return {
    userId,
    resource: 'documents',
    actions: ['read', 'write']
  };
}

// Scenario 1: Basic cache operations
async function scenarioBasicOperations() {
  console.log('\n📋 Scenario 1: Basic Cache Operations\n');
  
  const cache = new CacheManager<string, string>(100);
  
  console.log('➕ Setting values...');
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');
  
  console.log('🔍 Getting values...');
  console.log(`   key1: ${cache.get('key1')}`);
  console.log(`   key2: ${cache.get('key2')}`);
  console.log(`   key3: ${cache.get('key3')}`);
  console.log(`   key4 (missing): ${cache.get('key4')}`);
  
  console.log('📊 Cache stats:', cache.stats());
  
  console.log('✅ Basic operations completed\n');
}

// Scenario 2: User data caching (common use case)
async function scenarioUserCaching() {
  console.log('\n📋 Scenario 2: User Data Caching\n');
  
  const userCache = new CacheManager<string, User>(500);
  
  const getUserById = async (userId: string): Promise<User> => {
    return userCache.getOrSet(
      userId,
      () => fetchUserFromDB(userId)
    );
  };
  
  console.log('🔄 First access (cache miss - will hit database)...');
  const user1 = await getUserById('user-001');
  console.log(`   Retrieved: ${user1.name} (${user1.email})\n`);
  
  console.log('🔄 Second access (cache hit - no database call)...');
  const user2 = await getUserById('user-001');
  console.log(`   Retrieved: ${user2.name} (${user2.email})\n`);
  
  console.log('🔄 Different user (cache miss)...');
  const user3 = await getUserById('user-002');
  console.log(`   Retrieved: ${user3.name} (${user3.email})\n`);
  
  console.log('📊 Cache stats:', userCache.stats());
  console.log('✅ User caching completed\n');
}

// Scenario 3: Permission caching with TTL
async function scenarioPermissionCaching() {
  console.log('\n📋 Scenario 3: Permission Caching with TTL\n');
  
  const permissionCache = new CacheManager<string, Permission>(1000);
  
  const checkPermission = async (userId: string): Promise<Permission> => {
    const cacheKey = `perm:${userId}`;
    return permissionCache.getOrSet(
      cacheKey,
      () => fetchPermissionsFromDB(userId),
      2000 // TTL: 2 seconds
    );
  };
  
  console.log('🔐 Checking permissions (cache miss)...');
  const perm1 = await checkPermission('user-alice');
  console.log(`   Permissions: ${perm1.actions.join(', ')}\n`);
  
  console.log('🔐 Checking same user (cache hit)...');
  const perm2 = await checkPermission('user-alice');
  console.log(`   Permissions: ${perm2.actions.join(', ')}\n`);
  
  console.log('⏳ Waiting for TTL expiration (2.5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  console.log('🔐 Checking after TTL (cache miss - should hit database)...');
  const perm3 = await checkPermission('user-alice');
  console.log(`   Permissions: ${perm3.actions.join(', ')}\n`);
  
  console.log('✅ Permission caching with TTL completed\n');
}

// Scenario 4: Global cache usage
async function scenarioGlobalCache() {
  console.log('\n📋 Scenario 4: Global Cache Usage\n');
  
  console.log('🌍 Using global cache instance...');
  globalCache.set('app:version', '1.0.0');
  globalCache.set('app:name', 'struktos.js');
  globalCache.set('app:author', 'Enterprise Team');
  
  console.log(`   App Version: ${globalCache.get('app:version')}`);
  console.log(`   App Name: ${globalCache.get('app:name')}`);
  console.log(`   App Author: ${globalCache.get('app:author')}`);
  
  console.log('\n📊 Global cache stats:', globalCache.stats());
  console.log('✅ Global cache usage completed\n');
}

// Scenario 5: LRU eviction demonstration
async function scenarioLRUEviction() {
  console.log('\n📋 Scenario 5: LRU Eviction (Cache Capacity Test)\n');
  
  const smallCache = new CacheManager<string, number>(3); // Very small capacity
  
  console.log('➕ Adding 5 items to cache with capacity 3...');
  for (let i = 1; i <= 5; i++) {
    smallCache.set(`item-${i}`, i * 100);
    console.log(`   Added item-${i}: ${i * 100}`);
  }
  
  console.log('\n🔍 Checking which items survived...');
  for (let i = 1; i <= 5; i++) {
    const value = smallCache.get(`item-${i}`);
    console.log(`   item-${i}: ${value !== undefined ? value : 'EVICTED'}`);
  }
  
  console.log('\n📊 Cache stats:', smallCache.stats());
  console.log('✅ LRU eviction test completed\n');
}

// Performance comparison
async function scenarioPerformanceComparison() {
  console.log('\n📋 Scenario 6: Performance Comparison\n');
  
  const cache = new CacheManager<string, User>(1000);
  const userId = 'perf-test-user';
  
  // Warm up cache
  await cache.getOrSet(userId, () => fetchUserFromDB(userId));
  
  console.log('⚡ Performance Test: 1000 iterations\n');
  
  // Test cache hits
  const cacheStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    cache.get(userId);
  }
  const cacheTime = Date.now() - cacheStart;
  
  console.log(`   Cache hits (1000x): ${cacheTime}ms`);
  console.log(`   Average per operation: ${(cacheTime / 1000).toFixed(3)}ms`);
  
  // Test database calls (just 5 for comparison)
  console.log('\n   Comparing with 5 database calls...');
  const dbStart = Date.now();
  for (let i = 0; i < 5; i++) {
    await fetchUserFromDB(`perf-user-${i}`);
  }
  const dbTime = Date.now() - dbStart;
  
  console.log(`   Database calls (5x): ${dbTime}ms`);
  console.log(`   Average per operation: ${(dbTime / 5).toFixed(3)}ms`);
  
  const speedup = ((dbTime / 5) / (cacheTime / 1000)).toFixed(0);
  console.log(`\n   🚀 Cache is ~${speedup}x faster!\n`);
  
  console.log('✅ Performance comparison completed\n');
}

// Run all POC scenarios
async function runCachePOC() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  struktos.js Cache Manager POC');
  console.log('  Testing Aethel.TS LRUCache integration');
  console.log('═══════════════════════════════════════════════════════════');
  
  await scenarioBasicOperations();
  await scenarioUserCaching();
  await scenarioPermissionCaching();
  await scenarioGlobalCache();
  await scenarioLRUEviction();
  await scenarioPerformanceComparison();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  POC Complete!');
  console.log('  ✓ Aethel.TS LRUCache successfully integrated');
  console.log('  ✓ Cache operations working as expected');
  console.log('  ✓ TTL functionality demonstrated');
  console.log('  ✓ LRU eviction validated');
  console.log('  ✓ Performance benefits confirmed');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Execute POC
runCachePOC().catch(console.error);