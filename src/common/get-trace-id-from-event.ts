import { CloudEvent } from 'firebase-functions/v2';

export function getTraceIdFromEvent(
  event: CloudEvent<unknown>,
): string | undefined {
  if ('traceparent' in event && typeof event.traceparent === 'string') {
    return event.traceparent.split('-')[1];
  }
}
