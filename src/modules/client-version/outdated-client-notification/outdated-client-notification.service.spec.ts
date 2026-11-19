import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { type Job, type Queue } from 'bullmq';
import { newUser } from '../../../../test/fixtures';
import { ClientVersionStatus } from '../client-version-policy.domain';
import { type ClientVersionUseCase } from '../client-version.usecase';
import { OutdatedClientNotificationService } from './outdated-client-notification.service';
import { OUTDATED_EMAIL_CONFIG } from '../../jobs/tasks/outdated-client-email/outdated-client-email.processor';
import { Time } from '../../../lib/time';

const user = newUser();
const client = 'drive-desktop-windows';
const version = '2.3.0';

const compatibilityWith = (status: ClientVersionStatus) => ({
  status,
  message: 'message',
  recommendedVersion: '2.8.1',
  sunsetAt: Time.now('2026-12-01T00:00:00.000Z'),
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('OutdatedClientNotificationService', () => {
  let service: OutdatedClientNotificationService;
  let clientVersionUseCase: DeepMocked<ClientVersionUseCase>;
  let queue: DeepMocked<Queue>;

  beforeEach(() => {
    clientVersionUseCase = createMock<ClientVersionUseCase>();
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(ClientVersionStatus.Deprecated),
    );
    queue = createMock<Queue>();
    queue.add.mockResolvedValue(createMock<Job>());
    service = new OutdatedClientNotificationService(
      clientVersionUseCase,
      queue,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When the app version is deprecated, then the user is queued to be emailed once per cooldown', () => {
    service.notifyIfOutdated(user, client, version);

    expect(queue.add).toHaveBeenCalledWith(
      'notify',
      {
        userId: user.id,
        client,
        version,
        sunsetAt: '2026-12-01T00:00:00.000Z',
      },
      {
        deduplication: {
          id: user.uuid,
          ttl: Time.durationInMs(OUTDATED_EMAIL_CONFIG.COOLDOWN_DAYS, 'day'),
        },
      },
    );
  });

  it.each([
    ClientVersionStatus.UpToDate,
    ClientVersionStatus.UpdateRecommended,
    ClientVersionStatus.Unsupported,
  ])('When the app version is %s, then the user is not queued', (status) => {
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(status),
    );

    service.notifyIfOutdated(user, client, version);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('When there is no jobs queue, then nothing happens', () => {
    const serviceWithoutQueue = new OutdatedClientNotificationService(
      clientVersionUseCase,
    );

    expect(() =>
      serviceWithoutQueue.notifyIfOutdated(user, client, version),
    ).not.toThrow();
  });

  it('When queuing fails, then the error does not reach the request', async () => {
    queue.add.mockRejectedValue(new Error('Redis is down'));

    expect(() => service.notifyIfOutdated(user, client, version)).not.toThrow();
    await flushPromises();
  });

  it('When the user was queued recently, then the queue is not called again', async () => {
    service.notifyIfOutdated(user, client, version);
    await flushPromises();

    service.notifyIfOutdated(user, client, version);

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('When the user was queued more than an hour ago, then the user is queued again', async () => {
    const now = performance.now();
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(now);
    service.notifyIfOutdated(user, client, version);
    await flushPromises();
    nowSpy.mockReturnValue(now + Time.durationInMs(1, 'hour') + 1);
    await flushPromises();

    service.notifyIfOutdated(user, client, version);

    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  it('When queuing failed, then the user is queued again on the next request', async () => {
    queue.add.mockRejectedValueOnce(new Error('Redis is down'));
    service.notifyIfOutdated(user, client, version);
    await flushPromises();

    service.notifyIfOutdated(user, client, version);

    expect(queue.add).toHaveBeenCalledTimes(2);
  });
});
