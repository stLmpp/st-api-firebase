import { HttpStatus } from '@nestjs/common';
import { FunctionsErrorCode } from 'firebase-functions/v2/https';

export function getHttpsErrorFromStatus(status: number): FunctionsErrorCode {
  return HttpsErrorMapping.get(status) ?? 'unknown';
}

const HttpsErrorMapping: ReadonlyMap<number, FunctionsErrorCode> = new Map<
  number,
  FunctionsErrorCode
>()
  .set(HttpStatus.CONTINUE, 'ok')
  .set(HttpStatus.SWITCHING_PROTOCOLS, 'ok')
  .set(HttpStatus.PROCESSING, 'ok')
  .set(HttpStatus.EARLYHINTS, 'ok')
  .set(HttpStatus.OK, 'ok')
  .set(HttpStatus.CREATED, 'ok')
  .set(HttpStatus.ACCEPTED, 'ok')
  .set(HttpStatus.NON_AUTHORITATIVE_INFORMATION, 'ok')
  .set(HttpStatus.NO_CONTENT, 'ok')
  .set(HttpStatus.RESET_CONTENT, 'ok')
  .set(HttpStatus.PARTIAL_CONTENT, 'data-loss')
  .set(HttpStatus.AMBIGUOUS, 'ok')
  .set(HttpStatus.MOVED_PERMANENTLY, 'ok')
  .set(HttpStatus.FOUND, 'ok')
  .set(HttpStatus.SEE_OTHER, 'ok')
  .set(HttpStatus.NOT_MODIFIED, 'ok')
  .set(HttpStatus.TEMPORARY_REDIRECT, 'ok')
  .set(HttpStatus.PERMANENT_REDIRECT, 'ok')
  .set(HttpStatus.BAD_REQUEST, 'invalid-argument')
  .set(HttpStatus.UNAUTHORIZED, 'unauthenticated')
  .set(HttpStatus.PAYMENT_REQUIRED, 'out-of-range')
  .set(HttpStatus.FORBIDDEN, 'permission-denied')
  .set(HttpStatus.NOT_FOUND, 'not-found')
  .set(HttpStatus.METHOD_NOT_ALLOWED, 'unavailable')
  .set(HttpStatus.NOT_ACCEPTABLE, 'invalid-argument')
  .set(HttpStatus.PROXY_AUTHENTICATION_REQUIRED, 'permission-denied')
  .set(HttpStatus.REQUEST_TIMEOUT, 'deadline-exceeded')
  .set(HttpStatus.CONFLICT, 'failed-precondition')
  .set(HttpStatus.GONE, 'unavailable')
  .set(HttpStatus.LENGTH_REQUIRED, 'invalid-argument')
  .set(HttpStatus.PRECONDITION_FAILED, 'failed-precondition')
  .set(HttpStatus.PAYLOAD_TOO_LARGE, 'invalid-argument')
  .set(HttpStatus.URI_TOO_LONG, 'invalid-argument')
  .set(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'invalid-argument')
  .set(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, 'invalid-argument')
  .set(HttpStatus.EXPECTATION_FAILED, 'failed-precondition')
  .set(HttpStatus.I_AM_A_TEAPOT, 'unavailable')
  .set(HttpStatus.MISDIRECTED, 'out-of-range')
  .set(HttpStatus.UNPROCESSABLE_ENTITY, 'failed-precondition')
  .set(HttpStatus.FAILED_DEPENDENCY, 'failed-precondition')
  .set(HttpStatus.PRECONDITION_REQUIRED, 'failed-precondition')
  .set(HttpStatus.TOO_MANY_REQUESTS, 'permission-denied')
  .set(HttpStatus.INTERNAL_SERVER_ERROR, 'internal')
  .set(HttpStatus.NOT_IMPLEMENTED, 'out-of-range')
  .set(HttpStatus.BAD_GATEWAY, 'internal')
  .set(HttpStatus.SERVICE_UNAVAILABLE, 'internal')
  .set(HttpStatus.GATEWAY_TIMEOUT, 'internal')
  .set(HttpStatus.HTTP_VERSION_NOT_SUPPORTED, 'failed-precondition');
