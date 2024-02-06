import { HttpStatus } from '@nestjs/common';
import { exception } from '@st-api/core';

export const QUEUE_BAD_REQUEST = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0001',
});
export const EVENT_BAD_FORMAT = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0002',
});
export const EVENT_BAD_REQUEST = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0003',
});
