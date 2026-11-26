import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { PreCreatedUserCheckout } from './pre-created-user-checkout.domain';
import { PreCreatedUserCheckoutModel } from './pre-created-user-checkout.model';
import { SequelizePreCreatedUserCheckoutRepository } from './pre-created-user-checkout.repository';
import { PreCreatedUserModel } from './pre-created-users.model';
import {
  newPreCreatedUserCheckout,
  newPreCreatedUser,
} from '../../../test/fixtures';

describe('SequelizePreCreatedUserCheckoutRepository', () => {
  let repository: SequelizePreCreatedUserCheckoutRepository;
  let preCreatedUserCheckoutModel: typeof PreCreatedUserCheckoutModel;
  let preCreatedUserModel: typeof PreCreatedUserModel;

  const asModel = (checkout: PreCreatedUserCheckout) =>
    ({ toJSON: () => ({ ...checkout }) }) as PreCreatedUserCheckoutModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizePreCreatedUserCheckoutRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get(SequelizePreCreatedUserCheckoutRepository);
    preCreatedUserCheckoutModel = module.get(
      getModelToken(PreCreatedUserCheckoutModel),
    );
    preCreatedUserModel = module.get(getModelToken(PreCreatedUserModel));
  });

  describe('Finding a checkout', () => {
    it('When the checkout is stored, then it is returned without looking at the pre-created users', async () => {
      const checkout = newPreCreatedUserCheckout();
      jest
        .spyOn(preCreatedUserCheckoutModel, 'findOne')
        .mockResolvedValueOnce(asModel(checkout));

      const result = await repository.findByEmail(checkout.email);

      expect(result).toBeInstanceOf(PreCreatedUserCheckout);
      expect(result).toMatchObject({
        networkUuid: checkout.networkUuid,
        status: checkout.status,
      });
      expect(preCreatedUserModel.findOne).not.toHaveBeenCalled();
    });

    it('When the checkout only exists in the pre-created users, then it is copied and returned', async () => {
      const preCreatedUser = newPreCreatedUser();
      preCreatedUser.status = PreCreatedUserStatus.PendingSetup;
      preCreatedUser.tierId = v4();
      preCreatedUser.setupEmailSentAt = new Date('2026-11-20T10:00:00Z');
      preCreatedUser.setupEmailResendCount = 2;
      const copied = newPreCreatedUserCheckout({
        networkUuid: preCreatedUser.uuid,
        email: preCreatedUser.username,
      });
      jest
        .spyOn(preCreatedUserCheckoutModel, 'findByPk')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(preCreatedUserModel, 'findOne')
        .mockResolvedValueOnce(
          preCreatedUser as unknown as PreCreatedUserModel,
        );
      jest
        .spyOn(preCreatedUserCheckoutModel, 'findByPk')
        .mockResolvedValueOnce(asModel(copied));

      const result = await repository.findByNetworkUuid(preCreatedUser.uuid);

      expect(preCreatedUserModel.findOne).toHaveBeenCalledWith({
        where: { uuid: preCreatedUser.uuid, status: { [Op.ne]: null } },
      });
      expect(preCreatedUserCheckoutModel.bulkCreate).toHaveBeenCalledWith(
        [
          {
            networkUuid: preCreatedUser.uuid,
            email: preCreatedUser.username,
            status: PreCreatedUserStatus.PendingSetup,
            tierId: preCreatedUser.tierId,
            setupEmailSentAt: preCreatedUser.setupEmailSentAt,
            setupEmailResendCount: 2,
          },
        ],
        { ignoreDuplicates: true },
      );
      expect(result.networkUuid).toBe(preCreatedUser.uuid);
    });

    it('When there is no checkout anywhere, then nothing is returned or copied', async () => {
      jest
        .spyOn(preCreatedUserCheckoutModel, 'findOne')
        .mockResolvedValueOnce(null);
      jest.spyOn(preCreatedUserModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.findByEmail('buyer@internxt.com');

      expect(result).toBeNull();
      expect(preCreatedUserModel.findOne).toHaveBeenCalledWith({
        where: { username: 'buyer@internxt.com', status: { [Op.ne]: null } },
      });
      expect(preCreatedUserCheckoutModel.bulkCreate).not.toHaveBeenCalled();
    });
  });

  describe('Updating a checkout only while it has the expected status', () => {
    it('When the checkout still has the status, then it is updated and the caller knows it won', async () => {
      const networkUuid = v4();
      const update = { status: PreCreatedUserStatus.PendingSetup };
      jest
        .mocked(preCreatedUserCheckoutModel.update)
        .mockResolvedValueOnce([1] as never);

      const result = await repository.updateByNetworkUuidAndStatus(
        networkUuid,
        PreCreatedUserStatus.AwaitingPayment,
        update,
      );

      expect(result).toBe(true);
      expect(preCreatedUserCheckoutModel.update).toHaveBeenCalledWith(update, {
        where: { networkUuid, status: PreCreatedUserStatus.AwaitingPayment },
      });
    });

    it('When another request changed the status first, then nothing is updated and the caller knows it lost', async () => {
      jest
        .mocked(preCreatedUserCheckoutModel.update)
        .mockResolvedValueOnce([0] as never);

      const result = await repository.updateByNetworkUuidAndStatus(
        v4(),
        PreCreatedUserStatus.AwaitingPayment,
        { status: PreCreatedUserStatus.PendingSetup },
      );

      expect(result).toBe(false);
    });
  });
});
