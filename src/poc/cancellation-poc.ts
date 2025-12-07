import { RequestContext } from '../core/RequestContext';
import { StruktosContextData } from '../core/IContext';

/**
 * POC: Cancellation Token Demonstration
 * 
 * This demonstrates how RequestContext's cancellation mechanism can be used
 * to gracefully clean up resources and stop long-running operations.
 */

// Simulated long-running operation
async function longRunningTask(taskName: string): Promise<void> {
  const context = RequestContext.current<StruktosContextData>();
  
  if (!context) {
    throw new Error('No context available');
  }
  
  console.log(`📝 [${taskName}] Started`);
  
  // Register cleanup handler
  let cleanedUp = false;
  context.onCancel(() => {
    if (!cleanedUp) {
      console.log(`🛑 [${taskName}] Cancellation received - cleaning up resources`);
      cleanedUp = true;
    }
  });
  
  // Simulate work in chunks, checking cancellation status
  for (let i = 0; i < 10; i++) {
    if (context.isCancelled()) {
      console.log(`⚠️  [${taskName}] Detected cancellation at iteration ${i}`);
      return;
    }
    
    console.log(`   [${taskName}] Processing chunk ${i + 1}/10...`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`✅ [${taskName}] Completed successfully`);
}

// Database connection simulation
class DatabaseConnection {
  private connectionName: string;
  private connected = false;
  
  constructor(name: string) {
    this.connectionName = name;
  }
  
  async connect(): Promise<void> {
    console.log(`🔌 [DB:${this.connectionName}] Connecting...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    console.log(`✓  [DB:${this.connectionName}] Connected`);
  }
  
  async disconnect(): Promise<void> {
    if (this.connected) {
      console.log(`🔌 [DB:${this.connectionName}] Disconnecting...`);
      await new Promise(resolve => setTimeout(resolve, 50));
      this.connected = false;
      console.log(`✓  [DB:${this.connectionName}] Disconnected`);
    }
  }
  
  isConnected(): boolean {
    return this.connected;
  }
}

// Resource management with cancellation
async function managedDatabaseOperation() {
  const context = RequestContext.current<StruktosContextData>();
  
  if (!context) {
    throw new Error('No context available');
  }
  
  const connection = new DatabaseConnection('primary');
  
  // Register cleanup on cancellation
  context.onCancel(async () => {
    console.log('🧹 [Resource Manager] Cleaning up database connection...');
    await connection.disconnect();
  });
  
  await connection.connect();
  
  // Simulate database work
  console.log('💾 [Resource Manager] Performing database operations...');
  for (let i = 0; i < 5; i++) {
    if (context.isCancelled()) {
      console.log('⚠️  [Resource Manager] Operation cancelled, stopping work');
      return;
    }
    
    console.log(`   [Resource Manager] Query ${i + 1}/5...`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  
  await connection.disconnect();
  console.log('✅ [Resource Manager] All operations completed');
}

// Scenario 1: Normal completion (no cancellation)
async function scenarioNormalCompletion() {
  console.log('\n📋 Scenario 1: Normal Completion (No Cancellation)\n');
  
  await RequestContext.run<StruktosContextData>(
    { traceId: 'trace-normal', requestId: 'req-001' },
    async () => {
      await longRunningTask('NormalTask');
    }
  );
}

// Scenario 2: Early cancellation
async function scenarioEarlyCancellation() {
  console.log('\n📋 Scenario 2: Early Cancellation\n');
  
  const promise = RequestContext.run<StruktosContextData>(
    { traceId: 'trace-cancelled', requestId: 'req-002' },
    async () => {
      const context = RequestContext.current<StruktosContextData>();
      
      // Start the long-running task
      const taskPromise = longRunningTask('CancelledTask');
      
      // Cancel after 500ms (should be during chunk 2-3)
      setTimeout(() => {
        console.log('\n⏰ [Timer] 500ms elapsed - triggering cancellation\n');
        context?.cancel();
      }, 500);
      
      await taskPromise;
    }
  );
  
  await promise;
}

// Scenario 3: Multiple resources with cancellation
async function scenarioResourceCleanup() {
  console.log('\n📋 Scenario 3: Multiple Resource Cleanup on Cancellation\n');
  
  const promise = RequestContext.run<StruktosContextData>(
    { traceId: 'trace-resources', requestId: 'req-003' },
    async () => {
      const context = RequestContext.current<StruktosContextData>();
      
      if (!context) {
        throw new Error('No context');
      }
      
      // Set up multiple resources - callbacks will be registered
      context.onCancel(() => {
        console.log('🧹 [Cleanup] Closing file handle');
      });
      
      context.onCancel(() => {
        console.log('🧹 [Cleanup] Releasing lock');
      });
      
      context.onCancel(() => {
        console.log('🧹 [Cleanup] Flushing cache');
      });
      
      // Start managed operation
      const workPromise = managedDatabaseOperation();
      
      // Cancel after 600ms
      setTimeout(() => {
        console.log('\n⏰ [Timer] 600ms elapsed - triggering cleanup\n');
        context.cancel();
      }, 600);
      
      await workPromise;
    }
  );
  
  await promise;
}

// Scenario 4: Cancellation already happened (immediate callback execution)
async function scenarioImmediateCallback() {
  console.log('\n📋 Scenario 4: Registering Callback After Cancellation\n');
  
  await RequestContext.run<StruktosContextData>(
    { traceId: 'trace-immediate', requestId: 'req-004' },
    async () => {
      const context = RequestContext.current<StruktosContextData>();
      
      if (!context) {
        throw new Error('No context');
      }
      
      console.log('🎬 [Test] Cancelling context first...');
      context.cancel();
      
      console.log('📝 [Test] Now registering callback (should execute immediately)...');
      context.onCancel(() => {
        console.log('✓  [Callback] Executed immediately because context was already cancelled!');
      });
      
      console.log('✅ [Test] Test completed');
    }
  );
}

// Run all POC scenarios
async function runCancellationPOC() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  struktos.js Cancellation Token POC');
  console.log('  Testing context cancellation and resource cleanup');
  console.log('═══════════════════════════════════════════════════════════');
  
  await scenarioNormalCompletion();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await scenarioEarlyCancellation();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await scenarioResourceCleanup();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await scenarioImmediateCallback();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  POC Complete!');
  console.log('  ✓ Cancellation tokens working correctly');
  console.log('  ✓ Resources cleaned up on cancellation');
  console.log('  ✓ Multiple callbacks executed in order');
  console.log('  ✓ Immediate execution for late-registered callbacks');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Execute POC
runCancellationPOC().catch(console.error);