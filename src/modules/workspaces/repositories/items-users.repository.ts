import { Injectable } from '@nestjs/common';
import { WorkspaceItemUser } from '../domains/workspace-items-users.domain';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class SequelizeWorkspaceItemsUsersRepository {
  constructor(
    @InjectModel(WorkspaceItemUserModel)
    private modelWorkspaceItemUser: typeof WorkspaceItemUserModel,
  ) {}

  async getAllByWorkspaceId(workspaceId: string): Promise<WorkspaceItemUser[]> {
    const itemsUsers = await this.modelWorkspaceItemUser.findAll({
      where: { workspaceId },
    });
    return itemsUsers.map((itemUser) => this.toDomain(itemUser));
  }

  toDomain(model: WorkspaceItemUserModel): WorkspaceItemUser {
    return WorkspaceItemUser.build({
      ...model.toJSON(),
    });
  }
}
