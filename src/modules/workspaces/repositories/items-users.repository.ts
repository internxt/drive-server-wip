import { Injectable } from '@nestjs/common';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import { InjectModel } from '@nestjs/sequelize';
import { User } from 'src/modules/user/user.domain';

@Injectable()
export class SequelizeWorkspaceItemsUsersRepository {
  constructor(
    @InjectModel(WorkspaceItemUserModel)
    private modelWorkspaceItemUser: typeof WorkspaceItemUserModel,
  ) {}

  async getAllByUserAndWorkspaceId(
    user: User,
    workspaceId: string,
  ): Promise<WorkspaceItemUser[]> {
    const itemsUsers = await this.modelWorkspaceItemUser.findAll({
      where: { workspaceId, createdBy: user.uuid },
    });
    return itemsUsers.map((itemUser) => this.toDomain(itemUser));
  }

  toDomain(model: WorkspaceItemUserModel): WorkspaceItemUser {
    return WorkspaceItemUser.build({
      ...model.toJSON(),
    });
  }
}
