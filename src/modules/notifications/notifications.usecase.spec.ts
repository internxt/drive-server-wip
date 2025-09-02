import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { NotificationsUseCases } from './notifications.usecase';
import { NotificationRepository } from './notifications.repository';

describe('NotificationsUseCases', () => {
  let usecases: NotificationsUseCases;
  let notificationRepository: NotificationRepository;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [NotificationsUseCases],
    })
      .useMocker(createMock)
      .compile();

    usecases = moduleRef.get<NotificationsUseCases>(NotificationsUseCases);
    notificationRepository = moduleRef.get<NotificationRepository>(
      NotificationRepository,
    );
  });

  it('When created, then it should be defined', () => {
    expect(usecases).toBeDefined();
    expect(notificationRepository).toBeDefined();
  });
});
