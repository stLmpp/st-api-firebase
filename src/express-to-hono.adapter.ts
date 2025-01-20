import type { Hono } from 'hono';
import type { onRequest } from 'firebase-functions/v2/https';
import { safeAsync } from '@st-api/core';
import { Readable } from 'node:stream';
import { Logger } from './logger.js';

const logger = Logger.create('expressToHonoAdapter');

type ReqAndRes = Parameters<Parameters<typeof onRequest>[0]>;

const METHODS_WITHOUT_REQUEST_BODY = ['GET', 'HEAD', 'OPTIONS'];
const METHODS_WITHOUT_RESPONSE_BODY = ['HEAD', 'OPTIONS'];

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
    body: !METHODS_WITHOUT_REQUEST_BODY.includes(req.method)
      ? req.rawBody
      : undefined,
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

  if (METHODS_WITHOUT_RESPONSE_BODY.includes(req.method)) {
    res.end();
    return;
  }

  if (fetchResponse.body) {
    const reader = fetchResponse.body.getReader();
    const stream = new Readable({
      read() {
        reader
          .read()
          .then(({ done, value }) => {
            this.push(done ? null : value);
          })
          .catch((streamError) => {
            logger.error('Error on Readable read', streamError);
            this.destroy(streamError);
          });
      },
    });

    stream.on('error', (streamError) => {
      logger.error('Stream error', streamError);
      res.status(500).send('Stream error occurred');
    });

    req.on('close', () => {
      logger.log('Client disconnected');
      reader
        .cancel()
        .catch((cancelledError) =>
          logger.error('Error canceling reader', cancelledError),
        );
      stream.destroy();
    });

    stream.pipe(res);
  }
  // End workaround
}
