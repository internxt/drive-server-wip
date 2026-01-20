import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import { SequelizeUserRepository } from '../user/user.repository';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { FileUseCases } from '../file/file.usecase';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { JWT_1DAY_EXPIRATION } from '../auth/constants';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { Workspace } from '../workspaces/domains/workspaces.domain';
import { SequelizeFeatureLimitsRepository } from '../feature-limit/feature-limit.repository';
import { Limit } from '../feature-limit/domain/limit.domain';
import { FeatureNameLimitMap } from './constants';

@Injectable()
export class GatewayUseCases {
  constructor(
    private readonly workspaceUseCases: WorkspacesUsecases,
    private readonly userRepository: SequelizeUserRepository,
    private readonly userUseCases: UserUseCases,
    private readonly cacheManagerService: CacheManagerService,
    private readonly storageNotificationService: StorageNotificationService,
    private readonly featureLimitService: FeatureLimitService,
    private readonly fileUseCases: FileUseCases,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly limitsRepository: SequelizeFeatureLimitsRepository,
  ) {}

  async initializeWorkspace(
    initializeWorkspaceDto: InitializeWorkspaceDto,
  ): Promise<{ workspace: Workspace }> {
    Logger.log(
      `Initializing workspace with owner id: ${initializeWorkspaceDto.ownerId}`,
    );
    const {
      ownerId,
      maxSpaceBytes,
      address,
      numberOfSeats,
      phoneNumber,
      tierId,
    } = initializeWorkspaceDto;

    if (tierId) {
      const tier = await this.featureLimitService.getTier(tierId);
      if (!tier) {
        throw new BadRequestException(`Tier with ID ${tierId} not found`);
      }
    }

    try {
      const result = await this.workspaceUseCases.initiateWorkspace(
        ownerId,
        maxSpaceBytes,
        {
          address,
          numberOfSeats,
          phoneNumber,
          tierId,
        },
      );
      return result;
    } catch (error) {
      Logger.error('[GATEWAY/WORKSPACE] Error initializing workspace', error);
      throw error;
    }
  }

  async updateWorkspace(
    ownerId: string,
    {
      tierId,
      maxSpaceBytes,
      numberOfSeats,
    }: { tierId?: string; maxSpaceBytes?: number; numberOfSeats?: number },
  ): Promise<void> {
    const owner = await this.userRepository.findByUuid(ownerId);
    if (!owner) {
      throw new BadRequestException('Owner not found');
    }

    const workspace = await this.workspaceUseCases.findOne({
      ownerId: owner.uuid,
      setupCompleted: true,
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const workspaceUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );
    if (!workspaceUser) {
      throw new NotFoundException('Workspace user not found!');
    }

    if (maxSpaceBytes !== undefined && numberOfSeats !== undefined) {
      await this.workspaceUseCases.updateWorkspaceLimit(
        workspace.id,
        maxSpaceBytes,
        numberOfSeats,
      );

      if (workspace.numberOfSeats !== numberOfSeats) {
        await this.workspaceUseCases.updateWorkspaceMemberCount(
          workspace.id,
          numberOfSeats,
        );
      }
    }

    if (tierId) {
      const tier = await this.featureLimitService.getTier(tierId);
      if (!tier) {
        throw new BadRequestException(`Tier with ID ${tierId} not found`);
      }

      if (tierId !== workspaceUser.tierId) {
        await this.userRepository.updateBy(
          { uuid: workspaceUser.uuid },
          { tierId: tierId },
        );
      }
    }
  }

  async updateWorkspaceStorage(
    ownerId: string,
    maxSpaceBytes: number,
    numberOfSeats: number,
  ): Promise<void> {
    try {
      const owner = await this.userRepository.findByUuid(ownerId);
      if (!owner) {
        throw new BadRequestException();
      }
      const workspace = await this.workspaceUseCases.findOne({
        ownerId: owner.uuid,
        setupCompleted: true,
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      await this.workspaceUseCases.updateWorkspaceLimit(
        workspace.id,
        maxSpaceBytes,
        workspace.numberOfSeats !== numberOfSeats ? numberOfSeats : undefined,
      );

      if (workspace.numberOfSeats !== numberOfSeats) {
        await this.workspaceUseCases.updateWorkspaceMemberCount(
          workspace.id,
          numberOfSeats,
        );
      }
    } catch (error) {
      Logger.error(
        `[GATEWAY/WORKSPACE] Error updating workspace for owner ${ownerId}`,
        error,
      );
      throw error;
    }
  }

  async validateStorageForPlanChange(
    ownerId: string,
    maxSpaceBytes: number,
    numberOfSeats: number,
  ): Promise<void> {
    const owner = await this.userRepository.findByUuid(ownerId);
    if (!owner) {
      throw new BadRequestException();
    }
    const workspace = await this.workspaceUseCases.findOne({
      ownerId: owner.uuid,
      setupCompleted: true,
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    await this.workspaceUseCases.validateStorageForPlanChange(
      workspace,
      maxSpaceBytes,
      workspace.numberOfSeats !== numberOfSeats ? numberOfSeats : undefined,
    );
  }

  async destroyWorkspace(ownerId: string): Promise<{ workspaceId: string }> {
    const owner = await this.userRepository.findByUuid(ownerId);
    if (!owner) {
      throw new BadRequestException();
    }
    const workspace = await this.workspaceUseCases.findOne({
      ownerId: owner.uuid,
      setupCompleted: true,
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    const workspaceMembers =
      await this.workspaceUseCases.deleteWorkspaceContent(workspace.id, owner);

    workspaceMembers.forEach((workspaceUser) => {
      this.storageNotificationService.workspaceLeft({
        payload: { workspaceId: workspace.id, workspaceName: workspace.name },
        user: workspaceUser.member,
        clientId: 'gateway',
      });
    });

    return { workspaceId: workspace.id };
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getUserCredentials(email: string) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokens = await this.userUseCases.getAuthTokens(
      user,
      undefined,
      JWT_1DAY_EXPIRATION,
    );

    const folder = await this.folderRepository.findById(user.rootFolderId);

    const userResponse = {
      email: user.email,
      userId: user.userId,
      root_folder_id: user.rootFolderId,
      rootFolderId: folder?.uuid,
      name: user.name,
      lastname: user.lastname,
      uuid: user.uuid,
      createdAt: user.createdAt,
      tierId: user.tierId,
      registerCompleted: user.registerCompleted,
      username: user.username,
      bridgeUser: user.bridgeUser,
      sharedWorkspace: user.sharedWorkspace,
      backupsBucket: user.backupsBucket,
      emailVerified: user.emailVerified,
      lastPasswordChangedAt: user.lastPasswordChangedAt,
    };

    return { user: userResponse, tokens };
  }

  async checkUserStorageExpansion(
    uuid: string,
    additionalBytes?: number,
  ): Promise<{
    canExpand: boolean;
    currentMaxSpaceBytes: number;
    expandableBytes: number;
  }> {
    const user = await this.userRepository.findByUuid(uuid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const userStorageData = await this.userUseCases.canUserExpandStorage(
      user,
      additionalBytes,
    );
    return userStorageData;
  }

  async getUserByUuid(uuid: string): Promise<User> {
    return this.userRepository.findByUuid(uuid);
  }

  async updateUser(
    user: User,
    {
      newStorageSpaceBytes,
      newTierId,
    }: { newStorageSpaceBytes?: number; newTierId?: string },
  ) {
    if (newTierId) {
      const tier = await this.featureLimitService.getTier(newTierId);
      if (!tier) {
        throw new BadRequestException(`Tier with ID ${newTierId} not found`);
      }
    }

    if (newTierId && newTierId !== user.tierId) {
      await this.userRepository.updateBy(
        { uuid: user.uuid },
        { tierId: newTierId },
      );
      user.tierId = newTierId;
    }

    if (!newStorageSpaceBytes) {
      return;
    }

    await this.userUseCases.updateUserStorage(user, newStorageSpaceBytes);

    try {
      // We first expire cache to make sure the cache of old drive-server is deleted too.
      await this.cacheManagerService.expireLimit(user.uuid);

      await this.cacheManagerService.setUserStorageLimit(
        user.uuid,
        newStorageSpaceBytes,
        1000 * 60,
      );
    } catch (error) {
      Logger.error(
        `[GATEWAY/LIMIT_CACHE] Error proactively setting cache for user ${user.uuid} with new limit ${newStorageSpaceBytes}`,
        error,
      );
    }

    const { deletedCount } =
      await this.fileUseCases.cleanupVersionsOnDisable(user.uuid);
    if (deletedCount > 0) {
      Logger.log(
        `[GATEWAY/RETENTION] Deleted ${deletedCount} file versions for user ${user.uuid} due to plan change`,
      );
    }
  }

  async handleFailedPayment(userId: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findByUuid(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.mailerService.sendFailedPaymentEmail(user.email);
    return { success: true };
  }

  async getUserLimitOverrides(userUuid: string) {
    const user = await this.userRepository.findByUuid(userUuid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.limitsRepository.findAllUserOverriddenLimits(user.uuid);
  }

  async findLimitByLabelAndValue(
    label: string,
    value: string,
  ): Promise<Limit | null> {
    const limit = await this.limitsRepository.findLimitByLabelAndValue(
      label,
      value,
    );

    return limit;
  }

  async overrideLimitForUser(
    userUuid: string,
    externalLimitName: string,
    value: string,
  ): Promise<void> {
    const user = await this.userRepository.findByUuid(userUuid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const label = FeatureNameLimitMap[externalLimitName];
    if (!label) {
      throw new BadRequestException(`Not valid feature '${externalLimitName}'`);
    }

    const limit = await this.limitsRepository.findLimitByLabelAndValue(
      label,
      value,
    );

    if (!limit) {
      throw new BadRequestException(
        `It seems the value '${value}' is not valid for feature '${externalLimitName}'`,
      );
    }

    await this.limitsRepository.upsertOverridenLimit(user.uuid, limit.id);
  }
}
