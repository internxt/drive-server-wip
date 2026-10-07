import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { PreCreatedUserModel } from './pre-created-users.model';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { PreCreatedUser } from './pre-created-user.domain';
import { newPreCreatedUser } from '../../../test/fixtures';

describe('SequelizePreCreatedUsersRepository', () => {
  let repository: SequelizePreCreatedUsersRepository;
  let preCreatedUserModel: typeof PreCreatedUserModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizePreCreatedUsersRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get(SequelizePreCreatedUsersRepository);
    preCreatedUserModel = module.get<typeof PreCreatedUserModel>(
      getModelToken(PreCreatedUserModel),
    );
  });

  describe('Finding a pre-created user by uuid', () => {
    it('When the pre-created user exists, then it is returned', async () => {
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.setupEmailSentAt = new Date('2026-09-25T10:00:00Z');
      jest.spyOn(preCreatedUserModel, 'findOne').mockResolvedValueOnce({
        toJSON: () => ({ ...preCreatedUser }),
      } as PreCreatedUserModel);

      const result = await repository.findByUuid(preCreatedUser.uuid);

      expect(result).toBeInstanceOf(PreCreatedUser);
      expect(result).toMatchObject({
        uuid: preCreatedUser.uuid,
        email: preCreatedUser.email,
        setupEmailSentAt: preCreatedUser.setupEmailSentAt,
      });
      expect(preCreatedUserModel.findOne).toHaveBeenCalledWith({
        where: { uuid: preCreatedUser.uuid },
      });
    });

    it('When the pre-created user does not exist, then nothing is returned', async () => {
      jest.spyOn(preCreatedUserModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findByUuid(v4());

      expect(result).toBeNull();
    });
  });

  describe('Updating a pre-created user by uuid', () => {
    it('When the pre-created user is updated, then only the given fields are changed for that uuid', async () => {
      const uuid = v4();
      const setupEmailSentAt = new Date();

      await repository.updateByUuid(uuid, { setupEmailSentAt });

      expect(preCreatedUserModel.update).toHaveBeenCalledWith(
        { setupEmailSentAt },
        { where: { uuid } },
      );
    });
  });

  describe('Updating a user only while it has the expected status', () => {
    test('When the user still has the status, then it is updated and the caller knows it won', async () => {
      const uuid = v4();
      const update = { status: PreCreatedUserStatus.PendingSetup };
      jest
        .mocked(preCreatedUserModel.update)
        .mockResolvedValueOnce([1] as never);

      const result = await repository.updateByUuidAndStatus(
        uuid,
        PreCreatedUserStatus.AwaitingPayment,
        update,
      );

      expect(result).toBe(true);
      expect(preCreatedUserModel.update).toHaveBeenCalledWith(update, {
        where: { uuid, status: PreCreatedUserStatus.AwaitingPayment },
      });
    });

    test('When another request changed the status first, then nothing is updated and the caller knows it lost', async () => {
      jest
        .mocked(preCreatedUserModel.update)
        .mockResolvedValueOnce([0] as never);

      const result = await repository.updateByUuidAndStatus(
        v4(),
        PreCreatedUserStatus.AwaitingPayment,
        { status: PreCreatedUserStatus.PendingSetup },
      );

      expect(result).toBe(false);
    });
  });
});
