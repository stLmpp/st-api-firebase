import { Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ZBody, ZRes } from '@st-api/core';
import { z } from 'zod';
import { Eventarc } from './eventarc.service.js';

const BodySchema = z.object({
  events: z
    .object({
      eventType: z.string().trim().min(1).openapi({
        description: 'Event Type',
      }),
      body: z.record(z.any()).or(z.array(z.any())).openapi({
        description: 'JSON that will be sent to the body of the event',
      }),
    })
    .array()
    .min(1),
});
type BodyType = z.infer<typeof BodySchema>;

@Controller('eventarc')
export class EventarcController {
  constructor(private readonly eventarc: Eventarc) {}

  @Post()
  @ZRes(z.void())
  @ApiOperation({
    description: 'Use this API to publish events to Eventarc',
  })
  async post(@ZBody(BodySchema) body: BodyType): Promise<void> {
    await this.eventarc.publish(
      body.events.map((event) => ({
        type: event.eventType,
        body: event.body,
      })),
    );
  }
}
