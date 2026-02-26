import { type EventEmitter2 } from '@nestjs/event-emitter';

export interface UsageInvalidatedEvent {
  userUuid: string;
  userId: number;
  source: string;
}

export const USAGE_INVALIDATED_EVENT = 'usage.invalidated';

export function emitUsageInvalidated(
  eventEmitter: EventEmitter2,
  userUuid: string,
  userId: number,
  source: string,
): void {
  eventEmitter.emit(USAGE_INVALIDATED_EVENT, { userUuid, userId, source });
}
