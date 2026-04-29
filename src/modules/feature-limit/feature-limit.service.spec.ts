import { Test } from '@nestjs/testing';
import { type Logger, NotFoundException } from '@nestjs/common';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { FeatureLimitService } from './feature-limit.service';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels, LimitTypes } from './limits.enum';
import { PlatformName } from '../../common/constants';
import { v4 } from 'uuid';
import {
  newFeatureLimit,
  newTier,
  newUser,
  newWorkspace,
} from '../../../test/fixtures';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { PaymentRequiredException } from './exceptions/payment-required.exception';

describe('FeatureLimitService', () => {
  let service: FeatureLimitService;
  let limitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
  let workspaceRepository: DeepMocked<SequelizeWorkspaceRepository>;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let cacheManagerService: DeepMocked<CacheManagerService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [FeatureLimitService],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = moduleRef.get<FeatureLimitService>(FeatureLimitService);
    limitsRepository = moduleRef.get(SequelizeFeatureLimitsRepository);
    workspaceRepository = moduleRef.get(SequelizeWorkspaceRepository);
    userRepository = moduleRef.get(SequelizeUserRepository);
    cacheManagerService = moduleRef.get(CacheManagerService);
  });

  describe('canUserAccessPlatform', () => {
    it('When limit exists and allows access, then it should return true', async () => {
      const tierId = v4();
      const userUuid = v4();
      const platform = PlatformName.CLI;
      const user = newUser({ attributes: { uuid: userUuid, tierId } });
      const mockLimit = newFeatureLimit({
        value: 'true',
        type: LimitTypes.Boolean,
      });

      userRepository.findByUuid.mockResolvedValueOnce(user);
      workspaceRepository.findByOwner.mockResolvedValueOnce([]);
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitsByLabelAndTiers.mockResolvedValueOnce([
        mockLimit,
      ]);

      const result = await service.canUserAccessPlatform(platform, userUuid);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(limitsRepository.findLimitsByLabelAndTiers).toHaveBeenCalledWith(
        [tierId],
        LimitLabels.CliAccess,
      );
      expect(result).toBe(true);
    });

    it('When limit is overriden and allows access, then it should return true', async () => {
      const tierId = v4();
      const userUuid = v4();
      const platform = PlatformName.CLI;
      const user = newUser({ attributes: { uuid: userUuid, tierId } });
      const mockLimit = newFeatureLimit({
        value: 'true',
        type: LimitTypes.Boolean,
      });

      userRepository.findByUuid.mockResolvedValueOnce(user);
      workspaceRepository.findByOwner.mockResolvedValueOnce([]);
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(mockLimit);

      const result = await service.canUserAccessPlatform(platform, userUuid);

      expect(result).toBe(true);
    });

    it('When limit exists and denies access, then it should return false', async () => {
      const tierId = v4();
      const userUuid = v4();
      const platform = PlatformName.CLI;
      const user = newUser({ attributes: { uuid: userUuid, tierId } });
      const mockLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.CliAccess,
        value: 'false',
      });

      userRepository.findByUuid.mockResolvedValueOnce(user);
      workspaceRepository.findByOwner.mockResolvedValueOnce([]);
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitsByLabelAndTiers.mockResolvedValueOnce([
        mockLimit,
      ]);

      const result = await service.canUserAccessPlatform(platform, userUuid);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(limitsRepository.findLimitsByLabelAndTiers).toHaveBeenCalledWith(
        [tierId],
        LimitLabels.CliAccess,
      );
      expect(result).toBe(false);
    });

    it('When limit does not exist, then it should allow access', async () => {
      const tierId = v4();
      const userUuid = v4();
      const user = newUser({ attributes: { uuid: userUuid, tierId } });

      userRepository.findByUuid.mockResolvedValueOnce(user);
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      workspaceRepository.findByOwner.mockResolvedValueOnce([]);
      limitsRepository.findLimitsByLabelAndTiers.mockResolvedValueOnce([]);

      const result = await service.canUserAccessPlatform(
        PlatformName.CLI,
        userUuid,
      );

      expect(userRepository.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(limitsRepository.findLimitsByLabelAndTiers).toHaveBeenCalledWith(
        [tierId],
        LimitLabels.CliAccess,
      );
      expect(result).toBe(true);
    });

    it('When user does not exist, then it should throw', async () => {
      const userUuid = v4();

      userRepository.findByUuid.mockResolvedValueOnce(null);

      await expect(
        service.canUserAccessPlatform(PlatformName.CLI, userUuid),
      ).rejects.toThrow(NotFoundException);

      expect(userRepository.findByUuid).toHaveBeenCalledWith(userUuid);
    });

    it('When user tier denies access but workspace tier allows, then it should return true', async () => {
      const userTierId = v4();
      const workspaceTierId = v4();
      const userUuid = v4();
      const workspaceUserUuid = v4();
      const user = newUser({
        attributes: { uuid: userUuid, tierId: userTierId },
      });
      const workspace = newWorkspace({
        owner: user,
        attributes: { workspaceUserId: workspaceUserUuid },
      });
      const workspaceUser = newUser({
        attributes: { uuid: workspaceUserUuid, tierId: workspaceTierId },
      });
      const denyLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.CliAccess,
        value: 'false',
      });
      const allowLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.CliAccess,
        value: 'true',
      });
      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      userRepository.findByUuid.mockResolvedValueOnce(user);
      workspaceRepository.findByOwner.mockResolvedValueOnce([workspace]);
      userRepository.findByUuids.mockResolvedValueOnce([workspaceUser]);
      limitsRepository.findLimitsByLabelAndTiers.mockResolvedValueOnce([
        denyLimit,
        allowLimit,
      ]);

      const result = await service.canUserAccessPlatform(
        PlatformName.CLI,
        userUuid,
      );

      expect(userRepository.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(workspaceRepository.findByOwner).toHaveBeenCalledWith(userUuid);
      expect(userRepository.findByUuids).toHaveBeenCalledWith([
        workspaceUserUuid,
      ]);
      expect(limitsRepository.findLimitsByLabelAndTiers).toHaveBeenCalledWith(
        [userTierId, workspaceTierId],
        LimitLabels.CliAccess,
      );
      expect(result).toBe(true);
    });
  });

  describe('getFileVersioningLimits', () => {
    it('When user exists and has tier limits, then it should return versioning limits', async () => {
      const userUuid = v4();
      const tierId = v4();
      const user = newUser({ attributes: { uuid: userUuid, tierId } });

      const tierLimits = [
        newFeatureLimit({
          type: LimitTypes.Boolean,
          label: LimitLabels.FileVersionEnabled,
          value: 'true',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxSize,
          value: '10485760',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionRetentionDays,
          value: '15',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxNumber,
          value: '10',
        }),
      ];

      userRepository.findByUuid.mockResolvedValueOnce(user);
      limitsRepository.findUserOverriddenLimitsByLabels.mockResolvedValueOnce(
        [],
      );
      limitsRepository.findLimitsByLabelsAndTier.mockResolvedValueOnce(
        tierLimits,
      );

      const result = await service.getFileVersioningLimits(userUuid);

      expect(result).toEqual({
        enabled: true,
        maxFileSize: 10485760,
        retentionDays: 15,
        maxVersions: 10,
      });
    });

    it('When user has overridden limits, then overrides should take precedence', async () => {
      const userUuid = v4();
      const tierId = v4();
      const user = newUser({ attributes: { uuid: userUuid, tierId } });

      const tierLimits = [
        newFeatureLimit({
          type: LimitTypes.Boolean,
          label: LimitLabels.FileVersionEnabled,
          value: 'true',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxSize,
          value: '10485760',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionRetentionDays,
          value: '15',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxNumber,
          value: '10',
        }),
      ];

      const overriddenLimits = [
        newFeatureLimit({
          type: LimitTypes.Boolean,
          label: LimitLabels.FileVersionEnabled,
          value: 'false',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxSize,
          value: '20971520',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionRetentionDays,
          value: '30',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxNumber,
          value: '20',
        }),
      ];

      userRepository.findByUuid.mockResolvedValueOnce(user);
      limitsRepository.findUserOverriddenLimitsByLabels.mockResolvedValueOnce(
        overriddenLimits,
      );
      limitsRepository.findLimitsByLabelsAndTier.mockResolvedValueOnce(
        tierLimits,
      );

      const result = await service.getFileVersioningLimits(userUuid);

      expect(result).toEqual({
        enabled: overriddenLimits[0].value === 'true',
        maxFileSize: Number(overriddenLimits[1].value),
        retentionDays: Number(overriddenLimits[2].value),
        maxVersions: Number(overriddenLimits[3].value),
      });
    });

    it('When user does not exist, then it should throw NotFoundException', async () => {
      const userUuid = v4();

      userRepository.findByUuid.mockResolvedValueOnce(null);

      await expect(service.getFileVersioningLimits(userUuid)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('When versioning is disabled, then enabled should be false', async () => {
      const userUuid = v4();
      const tierId = v4();
      const user = newUser({ attributes: { uuid: userUuid, tierId } });

      const tierLimits = [
        newFeatureLimit({
          type: LimitTypes.Boolean,
          label: LimitLabels.FileVersionEnabled,
          value: 'false',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxSize,
          value: '0',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionRetentionDays,
          value: '0',
        }),
        newFeatureLimit({
          type: LimitTypes.Counter,
          label: LimitLabels.FileVersionMaxNumber,
          value: '0',
        }),
      ];

      userRepository.findByUuid.mockResolvedValueOnce(user);
      limitsRepository.findUserOverriddenLimitsByLabels.mockResolvedValueOnce(
        [],
      );
      limitsRepository.findLimitsByLabelsAndTier.mockResolvedValueOnce(
        tierLimits,
      );

      const result = await service.getFileVersioningLimits(userUuid);

      expect(result).toEqual({
        enabled: false,
        maxFileSize: 0,
        retentionDays: 0,
        maxVersions: 0,
      });
    });
  });

  describe('enforceMaxUploadFileSize', () => {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    it('When user has no limit configured, then it should allow the upload', async () => {
      const user = newUser({ attributes: { tierId: v4() } });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(null);

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(500 * MB)),
      ).resolves.not.toThrow();
    });

    it('When file size is under tier limit, then it should allow the upload', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(100 * MB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(50 * MB)),
      ).resolves.not.toThrow();
    });

    it('When file size exceeds tier limit, then it should throw', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(100 * MB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(200 * MB)),
      ).rejects.toThrow(PaymentRequiredException);
    });

    it('When user has an overridden limit, then it should use it instead of tier limit', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const override = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(10 * GB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(override);

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(5 * GB)),
      ).resolves.not.toThrow();
      expect(cacheManagerService.getTierLimit).not.toHaveBeenCalled();
      expect(limitsRepository.findLimitByLabelAndTier).not.toHaveBeenCalled();
    });

    it('When user overridden limit is exceeded, then it should throw', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const override = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(100 * MB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(override);

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(200 * MB)),
      ).rejects.toThrow(PaymentRequiredException);
    });

    it('When tier limit is cached, then it should not hit the DB', async () => {
      const user = newUser({ attributes: { tierId: v4() } });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(String(1 * GB));

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(500 * MB)),
      ).resolves.not.toThrow();
      expect(limitsRepository.findLimitByLabelAndTier).not.toHaveBeenCalled();
    });

    it('When tier limit is cached and exceeded, then it should throw without hitting DB', async () => {
      const user = newUser({ attributes: { tierId: v4() } });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(String(100 * MB));

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(200 * MB)),
      ).rejects.toThrow(PaymentRequiredException);
      expect(limitsRepository.findLimitByLabelAndTier).not.toHaveBeenCalled();
    });

    it('When cache miss occurs, then it should populate the cache from DB', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(1 * GB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      await service.enforceMaxUploadFileSize(user, BigInt(500 * MB));

      expect(cacheManagerService.setTierLimit).toHaveBeenCalledWith(
        user.tierId,
        LimitLabels.MaxUploadFileSize,
        limit.value,
      );
    });

    it('When cache write fails, then it should still allow the upload', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: String(1 * GB),
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      cacheManagerService.getTierLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);
      cacheManagerService.setTierLimit.mockRejectedValueOnce(
        new Error('Redis unavailable'),
      );

      await expect(
        service.enforceMaxUploadFileSize(user, BigInt(500 * MB)),
      ).resolves.not.toThrow();
    });
  });

  describe('getMaxUploadFileSize', () => {
    it('When no override and no tier limit exist, then it should return null', async () => {
      const user = newUser({ attributes: { tierId: v4() } });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(null);

      const result = await service.getMaxUploadFileSize(user);

      expect(result).toBeNull();
      expect(limitsRepository.findUserOverriddenLimit).toHaveBeenCalledWith(
        user.uuid,
        LimitLabels.MaxUploadFileSize,
      );
      expect(limitsRepository.findLimitByLabelAndTier).toHaveBeenCalledWith(
        user.tierId,
        LimitLabels.MaxUploadFileSize,
      );
    });

    it('When tier limit exists and no override, then it should return the tier limit value', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: '1073741824',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(null);
      limitsRepository.findLimitByLabelAndTier.mockResolvedValueOnce(limit);

      const result = await service.getMaxUploadFileSize(user);

      expect(result).toBe(1073741824);
    });

    it('When user override exists, then it should return the override value without hitting tier', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const override = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: '10737418240',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(override);

      const result = await service.getMaxUploadFileSize(user);

      expect(result).toBe(10737418240);
      expect(limitsRepository.findLimitByLabelAndTier).not.toHaveBeenCalled();
    });

    it('When both override and tier limit exist, then override value should win', async () => {
      const user = newUser({ attributes: { tierId: v4() } });
      const override = newFeatureLimit({
        type: LimitTypes.Counter,
        label: LimitLabels.MaxUploadFileSize,
        value: '53687091200',
      });

      limitsRepository.findUserOverriddenLimit.mockResolvedValueOnce(override);

      const result = await service.getMaxUploadFileSize(user);

      expect(result).toBe(53687091200);
      expect(limitsRepository.findLimitByLabelAndTier).not.toHaveBeenCalled();
    });
  });

  describe('getTier', () => {
    it('When tier exists, then it should return the tier', async () => {
      const tierId = v4();
      const mockTier = newTier({ id: tierId });

      limitsRepository.findTierById.mockResolvedValueOnce(mockTier);

      const result = await service.getTier(tierId);

      expect(limitsRepository.findTierById).toHaveBeenCalledWith(tierId);
      expect(result).toBe(mockTier);
    });

    it('When tier does not exist, then it should return null', async () => {
      const tierId = v4();

      limitsRepository.findTierById.mockResolvedValueOnce(null);

      const result = await service.getTier(tierId);

      expect(limitsRepository.findTierById).toHaveBeenCalledWith(tierId);
      expect(result).toBeNull();
    });
  });
});
