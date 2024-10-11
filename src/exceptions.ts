import { exception } from '@st-api/core';
import { StatusCodes } from 'http-status-codes';

export const PUB_SUB_BAD_REQUEST = exception({
  status: StatusCodes.BAD_REQUEST,
  errorCode: 'FIREBASE-0001',
});
export const EVENTARC_BAD_FORMAT = exception({
  status: StatusCodes.BAD_REQUEST,
  errorCode: 'FIREBASE-0002',
});
export const EVENTARC_BAD_REQUEST = exception({
  status: StatusCodes.BAD_REQUEST,
  errorCode: 'FIREBASE-0003',
});
export const PUB_SUB_INVALID_HANDLER = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0004',
});
export const EVENTARC_INVALID_HANDLER = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0005',
});
export const PUB_SUB_PUBLISH_ERROR = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0006',
  message: 'Failed to publish PubSub message',
});
export const EVENTARC_PUBLISH_ERROR = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0007',
  message: 'Failed to publish Eventarc message',
});
export const CALLABLE_INVALID_HANDLER = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0008',
});
export const FUNCTION_CALL_UNKNOWN_ERROR = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0009',
});
export const FUNCTION_CALL_INVALID_RESPONSE = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0010',
});
export const CALLABLE_BAD_FORMAT = exception({
  status: StatusCodes.BAD_REQUEST,
  errorCode: 'FIREBASE-0011',
});
export const CALLABLE_BAD_REQUEST = exception({
  status: StatusCodes.BAD_REQUEST,
  errorCode: 'FIREBASE-0012',
});
export const CALLABLE_BAD_RESPONSE = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0013',
  message:
    'Our server replied with the wrong response. Please contact the support.',
});
export const CALLABLE_UNKNOWN_ERROR = exception({
  status: StatusCodes.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0014',
});
