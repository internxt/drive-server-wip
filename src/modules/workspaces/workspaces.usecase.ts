import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from '../user/user.domain';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { Team } from './domains/team.domain';
import { v4 } from 'uuid';
import { SequelizeTeamRepository } from './repositories/team.repository';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { CreateWorkSpaceDto } from './dto/create-workspace.dto';
import { Workspace } from './domains/workspaces.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { SequelizeUserRepository } from '../user/user.repository';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private networkService: BridgeService,
    private userRepository: SequelizeUserRepository,
  ) {}

  async createWorkspace(user: User, createWorkSpaceDto: CreateWorkSpaceDto) {
    const newWorkspaceId = v4();

    const whatEmailShouldIUse = user.email + 'test';

    const { userId: networkPass, uuid: userUuid } =
      await this.networkService.createUser(whatEmailShouldIUse);

    const workspaceUser = await this.userRepository.create({
      email: whatEmailShouldIUse,
      password: user.password,
      hKey: user.hKey,
      referralCode: v4(),
      uuid: userUuid,
      userId: networkPass,
      welcomePack: true,
      registerCompleted: true,
      username: whatEmailShouldIUse,
      bridgeUser: whatEmailShouldIUse,
      mnemonic: user.mnemonic,
    });

    const bucket = await this.networkService.createBucket(
      whatEmailShouldIUse,
      networkPass,
    );
    const [rootFolder] = await this.createInitialFolders(user, bucket.id);

    const defaultTeam = Team.build({
      id: v4(),
      workspaceId: newWorkspaceId,
      name: createWorkSpaceDto.name,
      managerId: user.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const workspace = Workspace.build({
      id: v4(),
      ownerId: user.uuid,
      name: createWorkSpaceDto.name,
      defaultTeamId: defaultTeam.id,
      workspaceUserId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.teamRepository.createTeam(newTeam);
  }

  async createTeam(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    createTeamDto: CreateTeamDto,
  ) {
    const workspace = await this.workspaceRepository.findOne({
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

    return this.teamRepository.createTeam(newTeam);
  }

  async getWorkspaceTeams(user: User, workspaceId: WorkspaceAttributes['id']) {
    const workspace = await this.workspaceRepository.findOne({
      ownerId: user.uuid,
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const teamsWithMemberCount =
      await this.teamRepository.getTeamsAndMembersCountByWorkspace(
        workspace.id,
      );

    return teamsWithMemberCount;
  }
}
