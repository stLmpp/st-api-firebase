import type { Hono } from 'hono';
import type { onRequest } from 'firebase-functions/v2/https';
import { safeAsync } from '@st-api/core';
import { Logger } from './logger.js';

const logger = Logger.create('expressToHonoAdapter');

type ReqAndRes = Parameters<Parameters<typeof onRequest>[0]>;

export async function expressToHonoAdapter(
  hono: Hono,
  req: ReqAndRes[0],
  res: ReqAndRes[1],
) {
  // Workaround for https://github.com/honojs/hono/issues/1695
  const url = new URL(req.url, `${req.protocol}://${req.get('host')}`);
  logger.debug(`url = ${url.toString()}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  const fetchRequest = new Request(url, {
    method: req.method,
    headers,
    body:
      req.method !== 'GET' && req.method !== 'HEAD' ? req.rawBody : undefined,
  });
  const [error, fetchResponse] = await safeAsync(async () =>
    hono.fetch(fetchRequest),
  );
  if (error) {
    logger.error(
      'Error while trying to pass the request from express to Hono',
      error,
    );
    res.status(500).send(error.message);
    return;
  }
  for (const [key, value] of fetchResponse.headers) {
    res.setHeader(key, value);
  }
  res.status(fetchResponse.status);
  const body = fetchResponse?.body;
  if (body) {
    const [errorBody, responseBody] = await safeAsync(async () => {
      const chunks: Uint8Array[] = [];
      let length = 0;
      for await (const chunk of body) {
        chunks.push(chunk);
        length += chunk.length;
      }
      return Buffer.concat(chunks, length);
    });
    if (errorBody) {
      logger.error('Failed to parse response body', errorBody);
      res.status(500).send('Failed to parse response body');
      return;
    }
    res.send(responseBody);
  }
  // End workaround
}
