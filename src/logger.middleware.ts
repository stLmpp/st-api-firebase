import { HonoRequest, MiddlewareHandler } from 'hono';
import { Logger } from './logger.js';
import { IncomingHttpHeaders } from 'node:http';

const HEADERS_TO_HIDE = ['x-api-key', 'authorization'];

function cleanHeaders(req: HonoRequest): IncomingHttpHeaders {
  const headers = { ...req.header() };
  let index = HEADERS_TO_HIDE.length;
  while (index--) {
    const key = HEADERS_TO_HIDE[index]!;
    headers[key] &&= '[REDACTED]';
  }
  return headers;
}

export function loggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    const url = c.req.url;
    const path = c.req.path;
    const params = c.req.param();
    const query = c.req.query();
    logger.debug(`[${method} ${path}] Request`, {
      url,
      method,
      params: JSON.stringify(params),
      query: JSON.stringify(query),
      headers: JSON.stringify(cleanHeaders(c.req)),
    });
    await next();
    logger.debug(`[${method} ${path}] Response`, {
      url,
      method,
      status: c.res.status,
    });
  };
}
