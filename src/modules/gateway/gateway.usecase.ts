import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import { SequelizeUserRepository } from '../user/user.repository';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { User } from '../user/user.domain';

@Injectable()
export class GatewayUseCases {
  constructor(
    private workspaceUseCases: WorkspacesUsecases,
    private userRepository: SequelizeUserRepository,
    private networkService: BridgeService,
  ) {}

  async initializeWorkspace(initializeWorkspaceDto: InitializeWorkspaceDto) {
    Logger.log(
      `Initializing workspace with owner id: ${initializeWorkspaceDto.ownerId}`,
    );
    const { ownerId, maxSpaceBytes, address, numberOfSeats, phoneNumber } =
      initializeWorkspaceDto;

    return this.workspaceUseCases.initiateWorkspace(ownerId, maxSpaceBytes, {
      address,
      numberOfSeats,
      phoneNumber,
    });
  }

  async updateWorkspaceStorage(
    ownerId: string,
    maxSpaceBytes: number,
    numberOfSeats: number,
  ): Promise<void> {
    const owner = await this.userRepository.findByUuid(ownerId);
    const spacePerSeat = maxSpaceBytes / numberOfSeats;
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

    if (workspace.numberOfSeats !== numberOfSeats) {
      await this.workspaceUseCases.updateWorkspaceMemberCount(
        workspace.id,
        numberOfSeats,
      );
    }

    const { username } = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );
    await this.networkService.setStorage(username, maxSpaceBytes);
    await this.workspaceUseCases.changeWorkspaceMembersStorageLimit(
      workspace.id,
      spacePerSeat,
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
    await this.workspaceUseCases.deleteWorkspaceContent(workspace.id, owner);
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
