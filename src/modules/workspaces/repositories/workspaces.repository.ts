import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TeamModel } from '../models/team.model';
import { Team } from '../domains/team.domain';
import { WorkspaceModel } from '../models/workspace.model';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';

@Injectable()
export class SequelizeWorkspacesRepository {
  constructor(
    @InjectModel(WorkspaceModel)
    private workspaceModel: typeof WorkspaceModel,
  ) {}

  async getById(id: WorkspaceAttributes['id']): Promise<WorkspaceModel> {
    const raw = await this.workspaceModel.findOne({ where: { id } });

    return raw;
  }

  async findOne(where: Partial<WorkspaceAttributes>): Promise<WorkspaceModel> {
    const raw = await this.workspaceModel.findOne({ where });

    return raw;
  }

  toDomain(model: TeamModel): Team {
    return Team.build({
      ...model.toJSON(),
    });
  }
}
