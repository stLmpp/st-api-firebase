import { Controller, Post } from '@nestjs/common';
import { ZBody, zDto, ZParams } from '@st-api/core';
import { z } from 'zod';

import { Logger } from '../logger.js';

import { FirebaseFunctions } from './firebase-functions.js';

class CallableParamDto extends zDto(
  z.object({
    callableName: z.string().trim().min(1),
  }),
) {}

class CallableBody extends zDto(z.any()) {}

@Controller()
export class FirebaseFunctionsController {
  constructor(private readonly firebaseFunctions: FirebaseFunctions) {}

  private readonly logger = Logger.create(this);

  @Post('/callable/:callableName')
  async callable(
    @ZParams() { callableName }: CallableParamDto,
    @ZBody() body: CallableBody,
  ): Promise<unknown> {
    this.logger.info(`Calling ${callableName} with body`, {
      body,
    });
    const [error, response] = await this.firebaseFunctions.call({
      body,
      name: callableName,
      schema: z.any(),
    });
    if (error) {
      throw error;
    }
    return response;
  }
}
