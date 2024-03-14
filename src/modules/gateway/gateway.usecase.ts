import { Injectable } from '@nestjs/common';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';

@Injectable()
export class GatewayUseCases {
  constructor(private workspaceUseCases: WorkspacesUsecases) {}

  async initializeWorkspace(initializeWorkspaceDto: InitializeWorkspaceDto) {
    const { ownerId, maxSpaceBytes } = initializeWorkspaceDto;
    return this.workspaceUseCases.initiateWorkspace(ownerId, maxSpaceBytes);
  }
}
