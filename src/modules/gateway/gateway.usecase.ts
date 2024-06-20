import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import { SequelizeUserRepository } from '../user/user.repository';
import { BridgeService } from '../../externals/bridge/bridge.service';

@Injectable()
export class GatewayUseCases {
  constructor(
    private workspaceUseCases: WorkspacesUsecases,
    private userRepository: SequelizeUserRepository,
    private networkService: BridgeService,
  ) {}

  async initializeWorkspace(initializeWorkspaceDto: InitializeWorkspaceDto) {
    const { ownerId, maxSpaceBytes, address } = initializeWorkspaceDto;

    return this.workspaceUseCases.initiateWorkspace(ownerId, maxSpaceBytes, {
      address,
    });
  }

  async updateWorkspaceStorage(
    ownerId: string,
    maxSpaceBytes: number,
  ): Promise<void> {
    const owner = await this.userRepository.findByUuid(ownerId);
    if (!owner) {
      throw new BadRequestException();
    }
    const workspaces = await this.workspaceUseCases.findByOwnerId(owner.uuid);
    if (!workspaces.length) {
      throw new NotFoundException();
    }
    await Promise.all(
      workspaces.map(async ({ setupCompleted, workspaceUserId }) => {
        if (setupCompleted) {
          const { email } =
            await this.userRepository.findByUuid(workspaceUserId);
          await this.networkService.setStorage(email, maxSpaceBytes);
        }
      }),
    );
  }

  async destroyWorkspace(ownerId: string): Promise<void> {
    const owner = await this.userRepository.findByUuid(ownerId);
    if (!owner) {
      throw new BadRequestException();
    }
    const workspaces = await this.workspaceUseCases.findByOwnerId(owner.uuid);
    if (!workspaces.length) {
      throw new NotFoundException();
    }
    await Promise.all(
      workspaces.map(async ({ id, setupCompleted }) => {
        if (setupCompleted) {
          await this.workspaceUseCases.deleteWorkspaceContent(id, owner);
        }
      }),
    );
  }
}
