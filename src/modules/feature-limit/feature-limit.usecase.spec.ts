import { type SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { type SequelizeSharingRepository } from '../sharing/sharing.repository';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { PaymentRequiredException } from './exceptions/payment-required.exception';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { newFeatureLimit, newUser } from '../../../test/fixtures';
import { LimitLabels, LimitTypes } from './limits.enum';
import { type Sharing } from '../sharing/sharing.domain';
import { InternalServerErrorException } from '@nestjs/common';

describe('FeatureLimitUsecases', () => {
  let service: FeatureLimitUsecases;
  let limitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
  let sharingRepository: DeepMocked<SequelizeSharingRepository>;

  beforeEach(async () => {
    limitsRepository = createMock<SequelizeFeatureLimitsRepository>();
    sharingRepository = createMock<SequelizeSharingRepository>();
    service = new FeatureLimitUsecases(limitsRepository, sharingRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enforceLimit', () => {
    const user = newUser();

    it('When limit is boolean type and it is false, then it should throw to enforce limit', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'false',
      });
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      await expect(
        service.enforceLimit('' as LimitLabels, user, {}),
      ).rejects.toThrow(PaymentRequiredException);
    });

    it('When limit is boolean type and it is true, then it should not enforce limit', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'true',
      });
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      const enforceLimit = await service.enforceLimit(
        '' as LimitLabels,
        user,
        {},
      );

      expect(enforceLimit).toBeFalsy();
    });

    it('When limit is counter and is surprassed, then limit should be enforced', async () => {
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(
        newFeatureLimit({
          type: LimitTypes.Counter,
          value: '4',
        }),
      );
      jest.spyOn(service, 'checkCounterLimit').mockResolvedValueOnce(true);

      await expect(
        service.enforceLimit('' as LimitLabels, user, {}),
      ).rejects.toThrow(PaymentRequiredException);
    });

    it('When limit is counter and is not surprassed, then limit should be not be enforced', async () => {
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(
        newFeatureLimit({
          type: LimitTypes.Counter,
          value: '4',
        }),
      );
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      jest.spyOn(service, 'checkCounterLimit').mockResolvedValueOnce(false);

      const enforceLimit = await service.enforceLimit(
        '' as LimitLabels,
        user,
        {},
      );

      expect(enforceLimit).toBeFalsy();
    });

    it('When user has an override for a boolean limit, then it should use the override instead of tier limit', async () => {
      const tierLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'false',
      });
      const userOverrideLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'true',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(
        userOverrideLimit,
      );
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(tierLimit);

      const enforceLimit = await service.enforceLimit(
        LimitLabels.CliAccess,
        user,
        {},
      );

      expect(limitsRepository.findUserOverriddenLimit).toHaveBeenCalledWith(
        user.uuid,
        LimitLabels.CliAccess,
      );
      expect(enforceLimit).toBeFalsy();
    });

    it('When user has no override, then it should fall back to tier limit', async () => {
      const tierLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'true',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(tierLimit);

      const enforceLimit = await service.enforceLimit(
        LimitLabels.CliAccess,
        user,
        {},
      );

      expect(limitsRepository.findUserOverriddenLimit).toHaveBeenCalledWith(
        user.uuid,
        LimitLabels.CliAccess,
      );
      expect(limitsRepository.findLimitByLabelAndTier).toHaveBeenCalledWith(
        user.tierId,
        LimitLabels.CliAccess,
      );
      expect(enforceLimit).toBeFalsy();
    });

    it('When user has an override for a counter limit, then it should use the override value', async () => {
      const tierLimit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '100',
      });
      const userOverrideLimit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '50',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(
        userOverrideLimit,
      );
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(tierLimit);
      jest.spyOn(service, 'checkCounterLimit').mockResolvedValueOnce(false);

      const enforceLimit = await service.enforceLimit(
        LimitLabels.MaxSharedItemInvites,
        user,
        {},
      );

      expect(limitsRepository.findUserOverriddenLimit).toHaveBeenCalledWith(
        user.uuid,
        LimitLabels.MaxSharedItemInvites,
      );
      expect(service.checkCounterLimit).toHaveBeenCalledWith(
        user,
        userOverrideLimit,
        {},
      );
      expect(enforceLimit).toBeFalsy();
    });
  });

  describe('checkMaxSharedItemsLimit', () => {
    const user = newUser();

    it('When if item is already shared, then should bypassLimit', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      const shouldLimitBeEnforcedSpy = jest.spyOn(
        limit,
        'shouldLimitBeEnforced',
      );
      sharingRepository.findOneSharingBy.mockResolvedValueOnce({
        id: '',
      } as Sharing);

      const enforceMaxSharedItemsLimit = await service.checkMaxSharedItemsLimit(
        {
          limit,
          user,
          data: { itemId: '', isPublicSharing: false, user },
        },
      );

      expect(enforceMaxSharedItemsLimit).toBeFalsy();
      expect(shouldLimitBeEnforcedSpy).toHaveBeenCalledWith({
        bypassLimit: true,
        currentCount: 0,
      });
    });

    it('When user has equal or more sharings than limit, limit should be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      sharingRepository.findOneSharingBy.mockResolvedValueOnce(null);
      sharingRepository.getSharedItemsNumberByUser.mockResolvedValueOnce(3);

      const enforceMaxSharedItemsLimit = await service.checkMaxSharedItemsLimit(
        {
          limit,
          user,
          data: { itemId: '', isPublicSharing: false, user },
        },
      );

      expect(enforceMaxSharedItemsLimit).toBeTruthy();
    });

    it('When user has less sharings than limit, limit should not be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '4',
      });

      sharingRepository.findOneSharingBy.mockResolvedValueOnce(null);
      sharingRepository.getSharedItemsNumberByUser.mockResolvedValueOnce(3);

      const enforceMaxSharedItemsLimit = await service.checkMaxSharedItemsLimit(
        {
          limit,
          user,
          data: { itemId: '', isPublicSharing: false, user },
        },
      );

      expect(enforceMaxSharedItemsLimit).toBeFalsy();
    });
  });

  describe('checkMaxInviteesPerItemLimit', () => {
    it('When item has more invitations than the limit, limit should be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      sharingRepository.getSharingsCountBy.mockResolvedValueOnce(3);
      sharingRepository.getInvitesCountBy.mockResolvedValueOnce(3);

      const enforceMaxInvitesPerItem =
        await service.checkMaxInviteesPerItemLimit({
          limit,
          data: { itemId: '', itemType: 'file' },
        });

      expect(enforceMaxInvitesPerItem).toBeTruthy();
    });

    it('When item has less invitations than the limit, limit should not be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      sharingRepository.getSharingsCountBy.mockResolvedValueOnce(0);
      sharingRepository.getInvitesCountBy.mockResolvedValueOnce(1);

      const enforceMaxInvitesPerItem =
        await service.checkMaxInviteesPerItemLimit({
          limit,
          data: { itemId: '', itemType: 'file' },
        });

      expect(enforceMaxInvitesPerItem).toBeFalsy();
    });

    it('When limit has enough invitations to surprass limit including owner, then limit should be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      sharingRepository.getSharingsCountBy.mockResolvedValueOnce(0);
      sharingRepository.getInvitesCountBy.mockResolvedValueOnce(2);

      const enforceMaxInvitesPerItem =
        await service.checkMaxInviteesPerItemLimit({
          limit,
          data: { itemId: '', itemType: 'file' },
        });

      expect(enforceMaxInvitesPerItem).toBeTruthy();
    });
  });

  describe('checkCounterLimit', () => {
    const user = newUser();

    it('When checkfunction is not defined, then it should throw', async () => {
      const limit = newFeatureLimit({
        label: 'notExistentLabel' as LimitLabels,
        type: LimitTypes.Counter,
        value: '3',
      });

      // limitCheckFunctions is a private value, this is just to access at runtime
      service['limitCheckFunctions']['limitLabel'] = jest.fn();

      await expect(
        service.checkCounterLimit(user, limit, {
          itemId: '',
          itemType: 'file',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('When checkfunction is defined, then it should be called with passed data', async () => {
      const limit = newFeatureLimit({
        label: 'limitLabel' as LimitLabels,
        type: LimitTypes.Counter,
        value: '3',
      });

      const mockCheckFunction = jest.fn();
      service['limitCheckFunctions']['limitLabel'] = mockCheckFunction;

      await service.checkCounterLimit(user, limit, {
        itemId: '',
        itemType: 'file',
      });

      expect(mockCheckFunction).toHaveBeenCalledWith({
        limit,
        user,
        data: { itemId: '', itemType: 'file' },
      });
    });
  });
});
