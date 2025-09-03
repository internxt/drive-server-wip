import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeNotificationRepository } from './notifications.repository';

describe('SequelizeNotificationRepository', () => {
  let repository: SequelizeNotificationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeNotificationRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeNotificationRepository>(
      SequelizeNotificationRepository,
    );
  });

  it('When created, then it should be defined', () => {
    expect(repository).toBeDefined();
  });
});
