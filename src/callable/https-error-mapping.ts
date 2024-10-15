import { FunctionsErrorCode } from 'firebase-functions/v2/https';
import { StatusCodes } from 'http-status-codes';

export function getHttpsErrorFromStatus(status: number): FunctionsErrorCode {
  return HttpsErrorMapping.get(status) ?? 'unknown';
}

const HttpsErrorMapping: ReadonlyMap<number, FunctionsErrorCode> = new Map<
  number,
  FunctionsErrorCode
>()
  .set(StatusCodes.CONTINUE, 'ok')
  .set(StatusCodes.SWITCHING_PROTOCOLS, 'ok')
  .set(StatusCodes.PROCESSING, 'ok')
  .set(StatusCodes.EARLY_HINTS, 'ok')
  .set(StatusCodes.OK, 'ok')
  .set(StatusCodes.CREATED, 'ok')
  .set(StatusCodes.ACCEPTED, 'ok')
  .set(StatusCodes.NON_AUTHORITATIVE_INFORMATION, 'ok')
  .set(StatusCodes.NO_CONTENT, 'ok')
  .set(StatusCodes.RESET_CONTENT, 'ok')
  .set(StatusCodes.PARTIAL_CONTENT, 'data-loss')
  .set(StatusCodes.MOVED_PERMANENTLY, 'ok')
  .set(StatusCodes.SEE_OTHER, 'ok')
  .set(StatusCodes.NOT_MODIFIED, 'ok')
  .set(StatusCodes.TEMPORARY_REDIRECT, 'ok')
  .set(StatusCodes.PERMANENT_REDIRECT, 'ok')
  .set(StatusCodes.BAD_REQUEST, 'invalid-argument')
  .set(StatusCodes.UNAUTHORIZED, 'unauthenticated')
  .set(StatusCodes.PAYMENT_REQUIRED, 'out-of-range')
  .set(StatusCodes.FORBIDDEN, 'permission-denied')
  .set(StatusCodes.NOT_FOUND, 'not-found')
  .set(StatusCodes.METHOD_NOT_ALLOWED, 'unavailable')
  .set(StatusCodes.NOT_ACCEPTABLE, 'invalid-argument')
  .set(StatusCodes.PROXY_AUTHENTICATION_REQUIRED, 'permission-denied')
  .set(StatusCodes.REQUEST_TIMEOUT, 'deadline-exceeded')
  .set(StatusCodes.CONFLICT, 'failed-precondition')
  .set(StatusCodes.GONE, 'unavailable')
  .set(StatusCodes.LENGTH_REQUIRED, 'invalid-argument')
  .set(StatusCodes.PRECONDITION_FAILED, 'failed-precondition')
  .set(StatusCodes.REQUEST_TOO_LONG, 'invalid-argument')
  .set(StatusCodes.REQUEST_URI_TOO_LONG, 'invalid-argument')
  .set(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'invalid-argument')
  .set(StatusCodes.REQUESTED_RANGE_NOT_SATISFIABLE, 'invalid-argument')
  .set(StatusCodes.EXPECTATION_FAILED, 'failed-precondition')
  .set(StatusCodes.IM_A_TEAPOT, 'unavailable')
  .set(StatusCodes.MISDIRECTED_REQUEST, 'out-of-range')
  .set(StatusCodes.UNPROCESSABLE_ENTITY, 'failed-precondition')
  .set(StatusCodes.FAILED_DEPENDENCY, 'failed-precondition')
  .set(StatusCodes.PRECONDITION_REQUIRED, 'failed-precondition')
  .set(StatusCodes.TOO_MANY_REQUESTS, 'permission-denied')
  .set(StatusCodes.INTERNAL_SERVER_ERROR, 'internal')
  .set(StatusCodes.NOT_IMPLEMENTED, 'out-of-range')
  .set(StatusCodes.BAD_GATEWAY, 'internal')
  .set(StatusCodes.SERVICE_UNAVAILABLE, 'internal')
  .set(StatusCodes.GATEWAY_TIMEOUT, 'internal')
  .set(StatusCodes.HTTP_VERSION_NOT_SUPPORTED, 'failed-precondition');
