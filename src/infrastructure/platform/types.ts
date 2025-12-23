/**
 * @struktos/core - Platform Types
 *
 * Core type definitions for Struktos platform abstraction layer.
 * These types enable protocol-agnostic request/response handling.
 */

/**
 * HTTP Status codes
 */
export enum HttpStatus {
  // 2xx Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,

  // 3xx Redirection
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,

  // 4xx Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  GONE = 410,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Protocol type for multi-protocol support
 */
export type ProtocolType =
  | 'http'
  | 'grpc'
  | 'websocket'
  | 'graphql'
  | 'message-queue';

/**
 * Abstract Response - Protocol-agnostic response structure
 * Can be converted to HTTP, gRPC, or message queue responses
 */
export interface StruktosResponse<T = any> {
  /** Response status code (HTTP-style) */
  status: number;

  /** Response headers */
  headers: Record<string, string | string[]>;

  /** Response body */
  body?: T;

  /** Content type */
  contentType?: string;

  /** Whether response has been sent */
  sent?: boolean;

  /** Protocol-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Abstract Request - Protocol-agnostic request structure
 */
export interface StruktosRequest<T = any> {
  /** Request ID */
  id: string;

  /** HTTP method or operation type */
  method: string;

  /** Request path/route */
  path: string;

  /** Request headers */
  headers: Record<string, string | string[] | undefined>;

  /** Query parameters */
  query: Record<string, string | string[] | undefined>;

  /** Route parameters */
  params: Record<string, string>;

  /** Request body */
  body?: T;

  /** Client IP address */
  ip?: string;

  /** Protocol type */
  protocol: ProtocolType;

  /** Raw underlying request (Express req, Fastify request, etc.) */
  raw?: any;

  /** Protocol-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Response builder for fluent API
 */
export class ResponseBuilder<T = any> {
  private response: StruktosResponse<T>;

  constructor() {
    this.response = {
      status: HttpStatus.OK,
      headers: {},
    };
  }

  /**
   * Set status code
   */
  status(code: number): this {
    this.response.status = code;
    return this;
  }

  /**
   * Set OK status (200)
   */
  ok(): this {
    return this.status(HttpStatus.OK);
  }

  /**
   * Set Created status (201)
   */
  created(): this {
    return this.status(HttpStatus.CREATED);
  }

  /**
   * Set No Content status (204)
   */
  noContent(): this {
    return this.status(HttpStatus.NO_CONTENT);
  }

  /**
   * Set Bad Request status (400)
   */
  badRequest(): this {
    return this.status(HttpStatus.BAD_REQUEST);
  }

  /**
   * Set Unauthorized status (401)
   */
  unauthorized(): this {
    return this.status(HttpStatus.UNAUTHORIZED);
  }

  /**
   * Set Forbidden status (403)
   */
  forbidden(): this {
    return this.status(HttpStatus.FORBIDDEN);
  }

  /**
   * Set Not Found status (404)
   */
  notFound(): this {
    return this.status(HttpStatus.NOT_FOUND);
  }

  /**
   * Set Internal Server Error status (500)
   */
  internalServerError(): this {
    return this.status(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Set a header
   */
  header(name: string, value: string | string[]): this {
    this.response.headers[name] = value;
    return this;
  }

  /**
   * Set multiple headers
   */
  headers(headers: Record<string, string | string[]>): this {
    Object.assign(this.response.headers, headers);
    return this;
  }

  /**
   * Set content type
   */
  contentType(type: string): this {
    this.response.contentType = type;
    this.response.headers['Content-Type'] = type;
    return this;
  }

  /**
   * Set JSON content type
   */
  json(): this {
    return this.contentType('application/json');
  }

  /**
   * Set body
   */
  body(data: T): this {
    this.response.body = data;
    return this;
  }

  /**
   * Set metadata
   */
  metadata(data: Record<string, any>): this {
    this.response.metadata = { ...this.response.metadata, ...data };
    return this;
  }

  /**
   * Build the response
   */
  build(): StruktosResponse<T> {
    return { ...this.response };
  }
}

/**
 * Create a new response builder
 */
export function response<T = any>(): ResponseBuilder<T> {
  return new ResponseBuilder<T>();
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
  traceId?: string;
  timestamp?: string;
  path?: string;
}

/**
 * Create an error response
 */
export function createErrorResponse(
  status: number,
  error: string,
  message: string,
  details?: any,
): StruktosResponse<ErrorResponse> {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: {
      error,
      message,
      statusCode: status,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}
