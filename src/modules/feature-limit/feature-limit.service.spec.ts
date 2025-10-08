import { Test } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { FeatureLimitService } from './feature-limit.service';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { LimitLabels, LimitTypes } from './limits.enum';
import { PlatformName } from '../../common/constants';
import { Limit } from './domain/limit.domain';
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
      const mockLimit = createMock<Limit>();
      mockLimit.shouldLimitBeEnforced.mockReturnValueOnce(false);

      userRepository.findByUuid.mockResolvedValueOnce(user);
      workspaceRepository.findByOwner.mockResolvedValueOnce([]);
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
