import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { type WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Sequelize } from 'sequelize';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { WorkspaceTeamUserModel } from '../models/workspace-team-users.model';
import { WorkspaceTeam } from '../domains/workspace-team.domain';
import { type WorkspaceTeamAttributes } from '../attributes/workspace-team.attributes';
import { type UserAttributes } from '../../user/user.attributes';
import { WorkspaceTeamUser } from '../domains/workspace-team-user.domain';
import { type WorkspaceTeamUserAttributes } from '../attributes/workspace-team-users.attributes';

@Injectable()
export class SequelizeWorkspaceTeamRepository {
  constructor(
    @InjectModel(WorkspaceTeamModel)
    private readonly teamModel: typeof WorkspaceTeamModel,
    @InjectModel(WorkspaceTeamUserModel)
    private readonly teamUserModel: typeof WorkspaceTeamUserModel,
  ) {}

  async createTeam(team: Omit<WorkspaceTeam, 'id'>): Promise<WorkspaceTeam> {
    const raw = await this.teamModel.create(team);

    return this.toDomain(raw);
  }

  async updateById(
    id: WorkspaceAttributes['id'],
    update: Partial<WorkspaceTeam>,
  ): Promise<void> {
    await this.teamModel.update(update, { where: { id } });
  }

  async getTeamMembers(teamId: WorkspaceTeamAttributes['id']) {
    const result = await this.teamUserModel.findAll({
      where: { teamId },
      include: { model: UserModel, required: true },
    });

    return result.map((teamUser) =>
      User.build({ ...teamUser.member.get({ plain: true }) }),
    );
  }

  async getTeamMembersCount(teamId: WorkspaceTeamAttributes['id']) {
    const membersCount = await this.teamUserModel.count({
      where: { id: teamId },
    });

    return membersCount ?? 0;
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

  async getTeamUser(
    userUuid: UserAttributes['uuid'],
    teamId: WorkspaceTeamAttributes['id'],
  ): Promise<WorkspaceTeamUser | null> {
    const teamUser = await this.teamUserModel.findOne({
      where: {
        memberId: userUuid,
        teamId,
      },
    });

    return teamUser ? this.teamUserToDomain(teamUser) : null;
  }

  async getTeamById(
    teamId: WorkspaceTeamAttributes['id'],
  ): Promise<WorkspaceTeam | null> {
    const raw = await this.teamModel.findOne({ where: { id: teamId } });

    return raw ? this.toDomain(raw) : null;
  }

  async getTeamAndMemberByWorkspaceAndMemberId(
    workspaceId: WorkspaceAttributes['id'],
    memberId: WorkspaceTeamUserAttributes['memberId'],
  ): Promise<
    {
      team: WorkspaceTeam;
      teamUser: WorkspaceTeamUser;
    }[]
  > {
    const memberTeamsAndData = await this.teamUserModel.findAll({
      where: { memberId },
      include: {
        model: this.teamModel,
        required: true,
        where: { workspaceId },
      },
    });

    return memberTeamsAndData.map((teamUser) => ({
      team: this.toDomain(teamUser.team),
      teamUser: this.teamUserToDomain(teamUser),
    }));
  }

  async removeMemberFromTeam(
    teamId: WorkspaceTeamAttributes['id'],
    memberId: User['uuid'],
  ): Promise<void> {
    await this.teamUserModel.destroy({
      where: { teamId, memberId },
    });
  }

  async addUserToTeam(
    teamId: WorkspaceTeamAttributes['id'],
    userUuid: UserAttributes['uuid'],
  ): Promise<WorkspaceTeamUser | null> {
    const teamUser = await this.teamUserModel.create({
      teamId,
      memberId: userUuid,
    });

    return this.teamUserToDomain(teamUser);
  }

  async deleteUserFromTeam(
    memberId: WorkspaceTeamUser['memberId'],
    teamId: WorkspaceTeam['id'],
  ): Promise<void> {
    await this.teamUserModel.destroy({ where: { memberId, teamId } });
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
      group: ['WorkspaceTeamModel.id'],
    });

    return teams.map((team) => ({
      team: this.toDomain(team),
      membersCount: parseInt(team.dataValues?.membersCount),
    }));
  }

  async getTeamsInWorkspace(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<WorkspaceTeam[] | null> {
    const teams = await this.teamModel.findAll({
      where: { workspaceId },
    });

    return teams.map((team) => this.toDomain(team));
  }

  async getTeamsInWorkspaceCount(workspaceId: WorkspaceAttributes['id']) {
    const teamsCount = await this.teamModel.count({
      where: { workspaceId },
    });

    return teamsCount;
  }

  async deleteTeamById(teamId: WorkspaceTeamAttributes['id']): Promise<void> {
    await this.teamModel.destroy({ where: { id: teamId } });
  }

  async getTeamsWhereUserIsManagerByWorkspaceId(
    workspaceId: WorkspaceAttributes['id'],
    user: User,
  ): Promise<WorkspaceTeam[]> {
    const teams = await this.teamModel.findAll({
      where: { workspaceId, managerId: user.uuid },
    });

    return teams.map((team) => this.toDomain(team));
  }

  async getTeamsUserBelongsTo(
    memberId: WorkspaceTeamUserAttributes['memberId'],
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<WorkspaceTeam[]> {
    const results = await this.teamUserModel.findAll({
      where: { memberId },
      include: {
        model: WorkspaceTeamModel,
        where: { workspaceId },
      },
    });

    return results.map((teamUser) => this.toDomain(teamUser.team));
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
