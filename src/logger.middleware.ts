import { IncomingHttpHeaders } from 'node:http';

import { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Logger } from './logger.js';

export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = Logger.create(this);

  private readonly headersToHide = ['x-api-key', 'authorization'];

  use(req: Request, _: Response, next: NextFunction): void {
    const { body, method: _method, params, query, originalUrl } = req;
    const method = _method.toUpperCase();
    this.logger.debug(`Received request at ${method} ${originalUrl}`, {
      url: originalUrl,
      method,
      body: JSON.stringify(body),
      params: JSON.stringify(params),
      query: JSON.stringify(query),
      headers: JSON.stringify(this.cleanHeaders(req)),
    });
    next();
  }

  private cleanHeaders(req: Request): IncomingHttpHeaders {
    const headers = { ...req.headers };
    let index = this.headersToHide.length;
    while (index--) {
      const key = this.headersToHide[index]!;
      headers[key] &&= '[REDACTED]';
    }
    return headers;
  }
}
