import { Injectable } from '@nestjs/common';
import { SharedWorkspaceRepository } from './shared-workspace.repository';
import { User } from '../modules/user/user.domain';
import { UserUseCases } from 'src/modules/user/user.usecase';

@Injectable()
export class SharedWorkspaceUsecases {
  constructor(
    private readonly repository: SharedWorkspaceRepository,
    private readonly usersUsecases: UserUseCases,
  ) {}

  async hostChangesUsername(user: User, newUsername: User['email']) {
    // Update guests username
    await this.usersUsecases.updateBridgeUser(user, newUsername);
  }
}
