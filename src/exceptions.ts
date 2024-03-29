import { HttpStatus } from '@nestjs/common';
import { exception } from '@st-api/core';

export const PUB_SUB_BAD_REQUEST = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0001',
});
export const EVENTARC_BAD_FORMAT = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0002',
});
export const EVENTARC_BAD_REQUEST = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0003',
});
export const PUB_SUB_INVALID_HANDLER = exception({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0004',
});
export const EVENTARC_INVALID_HANDLER = exception({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0005',
});
export const PUB_SUB_PUBLISH_ERROR = exception({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0006',
  message: 'Failed to publish PubSub message',
});
export const EVENTARC_PUBLISH_ERROR = exception({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode: 'FIREBASE-0007',
  message: 'Failed to publish Eventarc message',
});
