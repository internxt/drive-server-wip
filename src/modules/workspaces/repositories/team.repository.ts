import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Sequelize } from 'sequelize';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { WorkspaceTeamUserModel } from '../models/workspace-team-users.model';
import { WorkspaceTeam } from '../domains/workspace-team.domain';
import { WorkspaceTeamAttributes } from '../attributes/workspace-team.attributes';

@Injectable()
export class SequelizeWorkspaceTeamRepository {
  constructor(
    @InjectModel(WorkspaceTeamModel)
    private teamModel: typeof WorkspaceTeamModel,
    @InjectModel(WorkspaceTeamUserModel)
    private teamUserModel: typeof WorkspaceTeamUserModel,
  ) {}

  async createTeam(team: Omit<WorkspaceTeam, 'id'>): Promise<WorkspaceTeam> {
    const raw = await this.teamModel.create(team);

    return this.toDomain(raw);
  }

  async getTeamMembers(teamId: WorkspaceTeamAttributes['id']) {
    const result = await this.teamUserModel.findAll({
      where: { id: teamId },
      include: { model: UserModel, as: 'member' },
    });

    return result.map((teamUser) => User.build({ ...teamUser.member }));
  }

  async getTeamById(
    teamId: WorkspaceTeamAttributes['id'],
  ): Promise<WorkspaceTeam | null> {
    const raw = await this.teamModel.findOne({ where: { id: teamId } });

    return raw ? this.toDomain(raw) : null;
  }

  async getTeamsAndMembersCountByWorkspace(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<{ team: WorkspaceTeam; membersCount: number }[]> {
    const teams = await this.teamModel.findAll({
      where: { workspaceId },
      include: [
        {
          model: WorkspaceTeamUserModel,
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.fn('COUNT', Sequelize.col('teamUsers.id')),
            'membersCount',
          ],
        ],
      },
      group: ['TeamModel.id'],
    });

    return teams.map((team) => ({
      team: this.toDomain(team),
      membersCount: parseInt(team.dataValues?.membersCount),
    }));
  }

  toDomain(model: WorkspaceTeamModel): WorkspaceTeam {
    return WorkspaceTeam.build({
      ...model.toJSON(),
    });
  }
}
