/**
 * @struktos/core v1.0.0 - Basic Example
 * 
 * Demonstrates the core platform concepts:
 * - StruktosApp as application entry point
 * - Middleware pipeline
 * - Exception handling
 * - Context propagation
 * 
 * Note: This example uses a mock adapter since real adapters
 * are in separate packages (@struktos/adapter-express, etc.)
 */

import {
  StruktosApp,
  RequestContext,
  StruktosContextData,
  createMiddleware,
  LoggingMiddleware,
  TimingMiddleware,
  CorsMiddleware,
  BadRequestException,
  NotFoundException,
  ValidationException,
  ValidationExceptionFilter,
  IAdapter,
  AdapterBase,
  ServerInfo,
  MiddlewareContext,
  StruktosRequest,
  StruktosResponse,
  HttpStatus,
  IntervalService,
} from '../src/index';

// ==================== Mock Adapter ====================
// In real applications, use @struktos/adapter-express or @struktos/adapter-fastify

class MockAdapter extends AdapterBase {
  readonly name = 'mock';
  readonly protocol = 'http' as const;
  private serverInfo: ServerInfo | null = null;

  async start(port?: number, host?: string): Promise<ServerInfo> {
    this.running = true;
    this.serverInfo = {
      protocol: 'http',
      host: host || 'localhost',
      port: port || 3000,
      url: `http://${host || 'localhost'}:${port || 3000}`,
    };
    
    console.log(`[MockAdapter] Started on ${this.serverInfo.url}`);
    return this.serverInfo;
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('[MockAdapter] Stopped');
  }

  getServer(): any {
    return null;
  }

  transformRequest(raw: any): StruktosRequest {
    return {
      id: `req-${Date.now()}`,
      method: raw.method || 'GET',
      path: raw.path || '/',
      headers: raw.headers || {},
      query: raw.query || {},
      params: raw.params || {},
      body: raw.body,
      protocol: 'http',
      raw,
    };
  }

  transformResponse(response: StruktosResponse, raw: any): void {
    raw.status = response.status;
    raw.headers = response.headers;
    raw.body = response.body;
  }

  createContext(raw: any): MiddlewareContext {
    const request = this.transformRequest(raw);
    return {
      context: RequestContext.current()!,
      request,
      response: {
        status: HttpStatus.OK,
        headers: {},
      },
      items: new Map(),
    };
  }

  // Simulate handling a request
  async handleRequest(rawRequest: any): Promise<StruktosResponse> {
    return new Promise((resolve) => {
      RequestContext.run(
        {
          traceId: `trace-${Date.now()}`,
          timestamp: Date.now(),
          method: rawRequest.method,
          url: rawRequest.path,
        },
        async () => {
          const ctx = this.createContext(rawRequest);

          await this.executePipeline(ctx);

          resolve(ctx.response);
        }
      );
    });
  }
}

// ==================== Background Service Example ====================

class HealthCheckService extends IntervalService {
  readonly name = 'health-check';

  constructor() {
    super(10000); // Check every 10 seconds
  }

  protected async execute(): Promise<void> {
    console.log(`[HealthCheckService] Health check at ${new Date().toISOString()}`);
  }
}

// ==================== Custom Middleware Examples ====================

// Authentication middleware
const authMiddleware = createMiddleware(async (ctx, next) => {
  const authHeader = ctx.request.headers['authorization'];
  
  if (authHeader && authHeader === 'Bearer valid-token') {
    ctx.context.set('userId', 'user-123');
    ctx.context.set('user', { id: 'user-123', name: 'John Doe' });
    ctx.items.set('authenticated', true);
  }
  
  await next();
});

// Request validation middleware
const validateRequestMiddleware = createMiddleware(async (ctx, next) => {
  // Example: validate that POST requests have a body
  if (ctx.request.method === 'POST' && !ctx.request.body) {
    throw new BadRequestException('Request body is required for POST requests');
  }
  
  await next();
});

// Route handler middleware (simplified router)
const routerMiddleware = createMiddleware(async (ctx, next) => {
  const { method, path } = ctx.request;
  
  // Simulate routing
  if (method === 'GET' && path === '/') {
    ctx.response.status = HttpStatus.OK;
    ctx.response.body = { message: 'Welcome to Struktos!', version: '1.0.0' };
    return;
  }
  
  if (method === 'GET' && path === '/users') {
    const userId = ctx.context.get('userId');
    ctx.response.status = HttpStatus.OK;
    ctx.response.body = {
      users: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
      requestedBy: userId || 'anonymous',
    };
    return;
  }
  
  if (method === 'POST' && path === '/users') {
    const { name, email } = ctx.request.body || {};
    
    // Validation example
    const errors: Record<string, string[]> = {};
    if (!name) errors['name'] = ['Name is required'];
    if (!email) errors['email'] = ['Email is required'];
    
    if (Object.keys(errors).length > 0) {
      throw new ValidationException('Validation failed', errors);
    }
    
    ctx.response.status = HttpStatus.CREATED;
    ctx.response.body = { id: 'new-user-id', name, email };
    return;
  }
  
  if (method === 'GET' && path === '/error') {
    throw new Error('Simulated error');
  }
  
  // Not found
  throw new NotFoundException(`Route ${method} ${path} not found`);
});

// ==================== Main Application ====================

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  @struktos/core v1.0.0 - Platform Demo');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create application
  const app = StruktosApp.create({
    name: 'struktos-demo',
    useDefaultErrorHandler: true,
    includeTimings: true,
  });

  // Add middlewares
  app
    .use(new LoggingMiddleware({ logRequest: true, logResponse: true }))
    .use(new CorsMiddleware({ origin: '*' }))
    .use(authMiddleware)
    .use(validateRequestMiddleware)
    .use(routerMiddleware);

  // Add exception filters
  app.useExceptionFilter(new ValidationExceptionFilter());

  // Add background service
  // app.addService(new HealthCheckService()); // Uncomment to enable

  // Create adapter
  const adapter = new MockAdapter();

  // Start application
  const serverInfo = await app.listen(adapter, 3000);
  
  console.log('\n📍 Server Info:', serverInfo);
  console.log('\n🧪 Simulating requests...\n');

  // ==================== Simulate Requests ====================

  // 1. GET / - Welcome message
  console.log('--- Request 1: GET / ---');
  const res1 = await adapter.handleRequest({ method: 'GET', path: '/' });
  console.log('Response:', JSON.stringify(res1.body, null, 2));
  console.log();

  // 2. GET /users - Without auth
  console.log('--- Request 2: GET /users (no auth) ---');
  const res2 = await adapter.handleRequest({ method: 'GET', path: '/users' });
  console.log('Response:', JSON.stringify(res2.body, null, 2));
  console.log();

  // 3. GET /users - With auth
  console.log('--- Request 3: GET /users (with auth) ---');
  const res3 = await adapter.handleRequest({
    method: 'GET',
    path: '/users',
    headers: { authorization: 'Bearer valid-token' },
  });
  console.log('Response:', JSON.stringify(res3.body, null, 2));
  console.log();

  // 4. POST /users - Validation error
  console.log('--- Request 4: POST /users (validation error) ---');
  const res4 = await adapter.handleRequest({
    method: 'POST',
    path: '/users',
    body: { name: 'Test' }, // Missing email
  });
  console.log('Response:', JSON.stringify(res4.body, null, 2));
  console.log();

  // 5. POST /users - Success
  console.log('--- Request 5: POST /users (success) ---');
  const res5 = await adapter.handleRequest({
    method: 'POST',
    path: '/users',
    body: { name: 'New User', email: 'new@example.com' },
  });
  console.log('Response:', JSON.stringify(res5.body, null, 2));
  console.log();

  // 6. GET /unknown - Not found
  console.log('--- Request 6: GET /unknown (not found) ---');
  const res6 = await adapter.handleRequest({ method: 'GET', path: '/unknown' });
  console.log('Response:', JSON.stringify(res6.body, null, 2));
  console.log();

  // Stop application
  await app.stop();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Demo Complete!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run
main().catch(console.error);