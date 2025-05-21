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

@Injectable()
export class GatewayUseCases {
  constructor(
    private readonly workspaceUseCases: WorkspacesUsecases,
    private readonly userRepository: SequelizeUserRepository,
    private readonly userUseCases: UserUseCases,
    private readonly cacheManagerService: CacheManagerService,
    private readonly storageNotificationService: StorageNotificationService,
  ) {}

  async initializeWorkspace(initializeWorkspaceDto: InitializeWorkspaceDto) {
    Logger.log(
      `Initializing workspace with owner id: ${initializeWorkspaceDto.ownerId}`,
    );
    const { ownerId, maxSpaceBytes, address, numberOfSeats, phoneNumber } =
      initializeWorkspaceDto;

    try {
      return await this.workspaceUseCases.initiateWorkspace(
        ownerId,
        maxSpaceBytes,
        {
          address,
          numberOfSeats,
          phoneNumber,
        },
      );
    } catch (error) {
      Logger.error('[GATEWAY/WORKSPACE] Error initializing workspace', error);
      throw error;
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

  async destroyWorkspace(ownerId: string): Promise<void> {
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
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
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

  async updateUser(user: User, newStorageSpaceBytes?: number) {
    await this.userUseCases.updateUserStorage(user, newStorageSpaceBytes);

    try {
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
  }
}
