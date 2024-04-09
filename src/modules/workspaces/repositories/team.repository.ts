import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Sequelize, Transaction } from 'sequelize';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { WorkspaceTeamUserModel } from '../models/workspace-team-users.model';
import { WorkspaceTeam } from '../domains/workspace-team.domain';
import { WorkspaceTeamAttributes } from '../attributes/workspace-team.attributes';
import { UserAttributes } from '../../user/user.attributes';
import { WorkspaceTeamUser } from '../domains/workspace-team-user.domain';

@Injectable()
export class SequelizeWorkspaceTeamRepository {
  constructor(
    @InjectModel(WorkspaceTeamModel)
    private teamModel: typeof WorkspaceTeamModel,
    @InjectModel(WorkspaceTeamUserModel)
    private teamUserModel: typeof WorkspaceTeamUserModel,
  ) {}

  async createTeam(
    team: Omit<WorkspaceTeam, 'id'>,
    transaction?: Transaction,
  ): Promise<WorkspaceTeam> {
    const raw = await this.teamModel.create(team, { transaction });

    return this.toDomain(raw);
  }

  async updateById(
    id: WorkspaceAttributes['id'],
    update: Partial<WorkspaceTeam>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.teamModel.update(update, { where: { id }, transaction });
  }

  async getTeamMembers(teamId: WorkspaceTeamAttributes['id']) {
    const result = await this.teamUserModel.findAll({
      where: { id: teamId },
      include: { model: UserModel, as: 'member' },
    });

    return result.map((teamUser) => User.build({ ...teamUser.member }));
  }

  async getTeamUserAndTeamByTeamId(
    userUuid: UserAttributes['uuid'],
    teamId: WorkspaceTeamAttributes['id'],
  ): Promise<{
    team: WorkspaceTeam | null;
    teamUser: WorkspaceTeamUser | null;
  }> {
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      include: {
        required: false,
        model: WorkspaceTeamUserModel,
        where: { memberId: userUuid },
      },
    });

    return {
      team: team ? this.toDomain(team) : null,
      teamUser: team?.teamUsers?.[0]
        ? this.teamUserToDomain(team.teamUsers[0])
        : null,
    };
  }

  async getTeamById(
    teamId: WorkspaceTeamAttributes['id'],
  ): Promise<WorkspaceTeam | null> {
    const raw = await this.teamModel.findOne({ where: { id: teamId } });

    return raw ? this.toDomain(raw) : null;
  }

  async removeMemberFromTeam(
    teamId: WorkspaceTeamAttributes['id'],
    memberId: User['uuid'],
    transaction?: Transaction,
  ): Promise<void> {
    await this.teamUserModel.destroy({
      where: { teamId, memberId },
      transaction,
    });
  }

  async addMemberToTeam(
    teamId: WorkspaceTeamAttributes['id'],
    memberId: User['uuid'],
    transaction?: Transaction,
  ): Promise<void> {
    await this.teamUserModel.create({ teamId, memberId }, { transaction });
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

  async deleteTeamById(
    teamId: WorkspaceTeamAttributes['id'],
    transaction?: Transaction,
  ): Promise<void> {
    await this.teamModel.destroy({ where: { id: teamId }, transaction });
  }

  toDomain(model: WorkspaceTeamModel): WorkspaceTeam {
    return WorkspaceTeam.build({
      ...model.toJSON(),
    });
  }

  teamUserToDomain(model: WorkspaceTeamUserModel): WorkspaceTeamUser {
    return WorkspaceTeamUser.build({
      ...model.toJSON(),
    });
  }
}
