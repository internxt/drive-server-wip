import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeNotificationRepository } from './notifications.repository';
import { NotificationModel } from './models/notification.model';
import { newNotification } from '../../../test/fixtures';

describe('SequelizeNotificationRepository', () => {
  let repository: SequelizeNotificationRepository;
  let notificationModel: typeof NotificationModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeNotificationRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeNotificationRepository>(
      SequelizeNotificationRepository,
    );
    notificationModel = module.get<typeof NotificationModel>(
      getModelToken(NotificationModel),
    );
  });

  it('When created, then it should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('When creating a notification, then it should call the model create method and return domain object', async () => {
      const notification = newNotification();

      const mockCreatedModel = {
        ...notification,
        get: () => notification,
      } as any;

      jest
        .spyOn(notificationModel, 'create')
        .mockResolvedValueOnce(mockCreatedModel);
      jest.spyOn(repository, 'toDomain').mockReturnValueOnce(notification);

      const result = await repository.create(notification);

      expect(notificationModel.create).toHaveBeenCalledWith(notification);
      expect(repository.toDomain).toHaveBeenCalledWith(mockCreatedModel);
      expect(result).toEqual(notification);
    });
  });
});
