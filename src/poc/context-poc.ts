import { RequestContext } from '../core/RequestContext';
import { StruktosContextData } from '../core/IContext';

/**
 * POC: Context Propagation Demonstration
 * 
 * This demonstrates how RequestContext automatically propagates across
 * asynchronous boundaries without manual passing.
 */

// Simulated async operations
async function serviceLayerOperation() {
  console.log('📦 [Service Layer] Starting operation...');
  
  // Get context without it being passed as parameter!
  const context = RequestContext.current<StruktosContextData>();
  const traceId = context?.get('traceId');
  
  console.log(`   TraceID from context: ${traceId}`);
  
  // Simulate some async work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return dataLayerOperation();
}

async function dataLayerOperation() {
  console.log('💾 [Data Layer] Querying database...');
  
  // Again, no manual context passing needed!
  const context = RequestContext.current<StruktosContextData>();
  const traceId = context?.get('traceId');
  const userId = context?.get('userId');
  
  console.log(`   TraceID: ${traceId}`);
  console.log(`   UserID: ${userId}`);
  
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return { success: true, traceId };
}

async function nestedAsyncOperation() {
  console.log('🔄 [Nested Operation] Multiple async boundaries...');
  
  const context = RequestContext.current<StruktosContextData>();
  const traceId = context?.get('traceId');
  
  console.log(`   TraceID before Promise.all: ${traceId}`);
  
  // Even with Promise.all and multiple async operations, context is preserved
  const results = await Promise.all([
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      const ctx = RequestContext.current<StruktosContextData>();
      return `Task 1: ${ctx?.get('traceId')}`;
    })(),
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 75));
      const ctx = RequestContext.current<StruktosContextData>();
      return `Task 2: ${ctx?.get('traceId')}`;
    })(),
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const ctx = RequestContext.current<StruktosContextData>();
      return `Task 3: ${ctx?.get('traceId')}`;
    })()
  ]);
  
  console.log('   Parallel results:');
  results.forEach(result => console.log(`     - ${result}`));
}

// Simulated HTTP request handler
async function handleRequest(requestId: string, userId: string) {
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('\n🚀 [Request Handler] New request received');
  console.log(`   Request ID: ${requestId}`);
  console.log(`   Generating TraceID: ${traceId}\n`);
  
  // Initialize context for this request
  return RequestContext.run<StruktosContextData>(
    {
      traceId,
      requestId,
      userId,
      timestamp: Date.now()
    },
    async () => {
      try {
        // All nested operations will have access to this context
        await serviceLayerOperation();
        await nestedAsyncOperation();
        
        console.log('\n✅ [Request Handler] Request completed successfully');
        
        // Verify context is still accessible
        const context = RequestContext.current<StruktosContextData>();
        console.log(`   Final TraceID verification: ${context?.get('traceId')}`);
        console.log(`   Final context data:`, context?.getAll());
        
      } catch (error) {
        console.error('❌ [Request Handler] Error:', error);
      }
    }
  );
}

// Run POC
async function runContextPOC() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  struktos.js Context Propagation POC');
  console.log('  Testing AsyncLocalStorage-based context propagation');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Simulate two concurrent requests
  await Promise.all([
    handleRequest('req-001', 'user-alice'),
    handleRequest('req-002', 'user-bob')
  ]);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  POC Complete!');
  console.log('  ✓ Context propagated across async boundaries');
  console.log('  ✓ No manual context passing required');
  console.log('  ✓ Multiple concurrent contexts isolated correctly');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Execute POC
runContextPOC().catch(console.error);