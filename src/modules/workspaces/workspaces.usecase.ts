import { BadRequestException, Injectable } from '@nestjs/common';
import { SequelizeTeamsRepository } from './repositories/teams.repository';
import { User } from '../user/user.domain';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { Team } from './domains/team.domain';
import { v4 } from 'uuid';
import { SequelizeWorkspacesRepository } from './repositories/workspaces.repository';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamsRepository: SequelizeTeamsRepository,
    private readonly workspacesRepository: SequelizeWorkspacesRepository,
  ) {}

  async createTeam(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    createTeamDto: CreateTeamDto,
  ) {
    const workspace = await this.workspacesRepository.findOne({
      ownerId: user.uuid,
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const newTeam = Team.build({
      id: v4(),
      workspaceId: workspaceId,
      name: createTeamDto.name,
      managerId: createTeamDto.managerId ? createTeamDto.managerId : user.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.teamsRepository.createTeam(newTeam);
  }

  async getWorkspaceTeams(user: User, workspaceId: WorkspaceAttributes['id']) {
    const workspace = await this.workspacesRepository.findOne({
      ownerId: user.uuid,
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const teamsWithMemberCount =
      await this.teamsRepository.getTeamsAndMembersCountByWorkspace(
        workspace.id,
      );

    return teamsWithMemberCount;
  }
}
