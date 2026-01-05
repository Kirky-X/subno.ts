// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import http from 'http';
import { parse } from 'url';

// Extended request type with body and params
interface MockRequest extends http.IncomingMessage {
  body?: unknown;
  params?: Record<string, string>;
}

// Type for request handler
type RequestHandler = (req: MockRequest) => Promise<void>;

/**
 * Create a test HTTP server for Next.js API routes
 * This allows using supertest to test API endpoints
 */
export function createTestServer(
  handlers: Record<string, RequestHandler>
): http.Server {
  return http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    // Find matching handler
    const handlerKey = `${method} ${pathname}`;
    
    // Check for exact match first
    if (handlers[handlerKey]) {
      try {
        await handlers[handlerKey](req as MockRequest);
      } catch (error) {
        console.error('Handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // Handle dynamic routes
    const handlerPatterns = Object.keys(handlers).filter(k => k.includes(':'));
    for (const pattern of handlerPatterns) {
      const [patternMethod, patternPath] = pattern.split(' ');
      if (method !== patternMethod) continue;

      // Convert pattern to regex
      const patternParts = patternPath.split('/');
      const pathParts = pathname.split('/');

      if (patternParts.length !== pathParts.length) continue;

      let matches = true;
      const params: Record<string, string> = {};

      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        // Store params in headers for handler to access
        req.headers['x-params'] = JSON.stringify(params);
        try {
          await handlers[pattern](req as MockRequest);
        } catch (error) {
          console.error('Handler error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      }
    }

    // No handler found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

/**
 * Create a mock Next.js Request object
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): MockRequest {
  const { method = 'GET', body, headers = {} } = options;
  // const parsed = parse(url, true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = new http.IncomingMessage(null as any);

  req.url = url;
  req.method = method;
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;
  req.complete = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).headers = {
    'content-type': 'application/json',
    host: 'localhost:3000',
    ...headers,
  };

  // Store body for handlers that need it
  if (body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).body = body;
    req.headers['content-length'] = String(JSON.stringify(body).length);
  }

  // Store params
  const paramsHeader = req.headers['x-params'];
  if (paramsHeader) {
    try {
      const paramsStr = Array.isArray(paramsHeader) ? paramsHeader[0] : paramsHeader;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).params = JSON.parse(paramsStr);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).params = {};
    }
  }

  return req as MockRequest;
}

/**
 * Create a mock Next.js Response object
 */
export function createMockResponse(): {
  res: http.ServerResponse;
  status: (code: number) => { json: (data: unknown) => void };
  json: (data: unknown) => void;
  getHeader: (name: string) => string | number | string[] | undefined;
  setHeader: (name: string, value: string | number | string[]) => void;
} {
  const headers: Record<string, string | number | string[]> = {};
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = new http.ServerResponse(null as any);

  res.statusCode = 200;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).headers = {};

  res.writeHead = ((code: number, headersToSet?: Record<string, string | number | string[]>) => {
    res.statusCode = code;
    if (headersToSet) {
      Object.assign(headers, headersToSet);
    }
    return res;
  }) as typeof res.writeHead;

  res.end = ((data?: string | Buffer) => {
    if (data) {
      res.write(data);
    }
    res.emit('finish');
    return res;
  }) as typeof res.end;

  return {
    res,
    status: (code: number) => ({
      json: (data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(data));
      },
    }),
    json: (data: unknown) => {
      res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(data));
    },
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string | number | string[]) => {
      headers[name] = value;
    },
  };
}