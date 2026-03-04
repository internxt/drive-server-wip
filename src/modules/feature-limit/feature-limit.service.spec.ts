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

describe('FeatureLimitService', () => {
  let service: FeatureLimitService;
  let limitsRepository: DeepMocked<SequelizeFeatureLimitsRepository>;
  let workspaceRepository: DeepMocked<SequelizeWorkspaceRepository>;
  let userRepository: DeepMocked<SequelizeUserRepository>;

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
