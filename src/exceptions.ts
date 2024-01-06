import { HttpStatus } from '@nestjs/common';
import { exception } from '@st-api/core';

export const QUEUE_BAD_REQUEST = exception({
  status: HttpStatus.BAD_REQUEST,
  errorCode: 'FIREBASE-0001',
});
