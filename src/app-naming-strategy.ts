import { Logger } from './logger.js';

export interface StFirebaseAppNamingStrategy {
  callable(callableName: string): string;
  pubSub(topic: string): string;
  eventarc(eventType: string): string;
  custom(): string;
}

export class DefaultFirebaseAppNamingStrategy
  implements StFirebaseAppNamingStrategy
{
  private readonly logger = Logger.create(this);

  private pubSubCount = 0;
  private eventarcCount = 0;
  private customCount = 0;

  private sanitizeCallableName(name: string): string {
    return name
      .replaceAll(/[^\dA-Za-z-]/g, '_')
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .join('_');
  }

  private sanitizeName(name: string): string {
    if (name.length > 30) {
      this.logger.warn(
        `Event name "${name}" is too long (${name.length}). ` +
          'The maximum size is 30 characters. It will be cut',
      );
    }
    name = name.slice(0, 30);
    const last = name.at(-1) || '';
    if (!/[\dA-Za-z]$/.test(last)) {
      name = `${name}1`;
    }
    return name;
  }

  callable(callableName: string): string {
    return this.sanitizeName(this.sanitizeCallableName(callableName));
  }

  eventarc(): string {
    return `eventarc${this.eventarcCount++ || ''}`;
  }

  pubSub(): string {
    return `pubsub${this.pubSubCount++ || ''}`;
  }

  custom(): string {
    return `custom${this.customCount++ || ''}`;
  }
}
