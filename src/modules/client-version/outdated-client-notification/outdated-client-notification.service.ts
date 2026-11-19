import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { type Queue } from 'bullmq';
import { LRUCache } from 'lru-cache';
import { type User } from '../../user/user.domain';
import { ClientVersionStatus } from '../client-version-policy.domain';
import { ClientVersionUseCase } from '../client-version.usecase';
import {
  OUTDATED_CLIENT_EMAIL_QUEUE,
  OUTDATED_EMAIL_CONFIG,
  type OutdatedClientEmailJobData,
} from '../../jobs/tasks/outdated-client-email/outdated-client-email.processor';
import { Time } from '../../../lib/time';

@Injectable()
export class OutdatedClientNotificationService {
  // Skips a Redis call on every request of users queued recently by this instance
  private readonly recentlyQueued = new LRUCache<User['uuid'], true>({
    max: 10_000,
    ttl: Time.durationInMs(1, 'hour'),
  });

  constructor(
    private readonly clientVersionUseCase: ClientVersionUseCase,
    @Optional()
    @InjectQueue(OUTDATED_CLIENT_EMAIL_QUEUE)
    private readonly queue?: Queue<OutdatedClientEmailJobData>,
  ) {}

  notifyIfOutdated(user: User, client: string, version: string): void {
    if (!this.queue || this.recentlyQueued.has(user.uuid)) {
      return;
    }

    const { status, sunsetAt } = this.clientVersionUseCase.getCompatibility(
      client,
      version,
    );
    if (status !== ClientVersionStatus.Deprecated) {
      return;
    }

    this.queue
      .add(
        'notify',
        {
          userId: user.id,
          client,
          version,
          sunsetAt: sunsetAt?.toISOString() ?? null,
        },
        {
          deduplication: {
            id: user.uuid,
            ttl: Time.durationInMs(OUTDATED_EMAIL_CONFIG.COOLDOWN_DAYS, 'day'),
          },
        },
      )
      .then(() => this.recentlyQueued.set(user.uuid, true))
      .catch(() => undefined);
  }
}
