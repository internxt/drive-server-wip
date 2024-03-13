import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TeamModel } from '../models/team.model';
import { TeamUserModel } from '../models/team-users.model';
import { Team } from '../domains/team.domain';
import { TeamAttributes } from '../attributes/team.attributes';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Sequelize } from 'sequelize';

@Injectable()
export class SequelizeTeamsRepository {
  constructor(
    @InjectModel(TeamModel)
    private teamModel: typeof TeamModel,
    @InjectModel(TeamUserModel)
    private teamUserModel: typeof TeamUserModel,
  ) {}

  async createTeam(team: Omit<Team, 'id'>): Promise<Team> {
    const raw = await this.teamModel.create(team);

    return Team.build(raw);
  }

  async getTeamMembers(teamId: TeamAttributes['id']) {
    const result = await this.teamUserModel.findAll({
      where: { id: teamId },
      include: { model: UserModel, as: 'member' },
    });

    return result.map((teamUser) => User.build({ ...teamUser.member }));
  }

  async getTeamById(teamId: TeamAttributes['id']): Promise<Team | null> {
    const raw = await this.teamModel.findOne({ where: { id: teamId } });

    return raw ? this.toDomain(raw) : null;
  }

  async getTeamsAndMembersCountByWorkspace(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<{ team: Team; membersCount: number }[]> {
    const teams = await this.teamModel.findAll({
      where: { workspaceId },
      include: [
        {
          model: TeamUserModel,
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

  toDomain(model: TeamModel): Team {
    return Team.build({
      ...model.toJSON(),
    });
  }
}
