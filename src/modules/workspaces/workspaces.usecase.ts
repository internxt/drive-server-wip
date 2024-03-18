import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from '../user/user.domain';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { v4 } from 'uuid';
import { SequelizeWorkspaceTeamRepository } from './repositories/team.repository';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { Workspace } from './domains/workspaces.domain';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserAttributes } from '../user/user.attributes';
import { WorkspaceTeam } from './domains/workspace-team.domain';
import { SetupWorkspaceDto } from './dto/setup-workspace.dto';
import { WorkspaceUser } from './domains/workspace-user.domain';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeWorkspaceTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private networkService: BridgeService,
    private userRepository: SequelizeUserRepository,
  ) {}

  async initiateWorkspace(
    ownerId: UserAttributes['uuid'],
    maxSpaceBytes: number,
  ) {
    const owner = await this.userRepository.findByUuid(ownerId);

    if (!owner) {
      throw new BadRequestException();
    }

    const workspaceUserId = v4();
    const workspaceEmail = `${workspaceUserId}-workspace@internxt.com`;

    const { userId: networkUserId, uuid: _userUuid } =
      await this.networkService.createUser(workspaceEmail);
    await this.networkService.setStorage(workspaceEmail, maxSpaceBytes);

    const workspaceUser = await this.userRepository.create({
      email: workspaceEmail,
      name: '',
      lastname: '',
      password: owner.password,
      hKey: owner.hKey,
      referralCode: v4(),
      uuid: workspaceUserId,
      userId: networkUserId,
      username: workspaceEmail,
      bridgeUser: workspaceEmail,
      mnemonic: owner.mnemonic,
    });

    const workspaceId = v4();

    const newDefaultTeam = WorkspaceTeam.build({
      id: v4(),
      workspaceId: null,
      managerId: owner.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newWorkspace = Workspace.build({
      id: workspaceId,
      ownerId: owner.uuid,
      name: '',
      defaultTeamId: newDefaultTeam.id,
      workspaceUserId: workspaceUser.uuid,
      setupCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.teamRepository.createTeam(newDefaultTeam);
    await this.workspaceRepository.create(newWorkspace);
    await this.teamRepository.updateById(newDefaultTeam.id, { workspaceId });

    return {
      workspace: newWorkspace,
    };
  }

  async setupWorkspace(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    setupWorkspaceDto: SetupWorkspaceDto,
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new BadRequestException();
    }

    const workspaceUser = WorkspaceUser.build({
      id: v4(),
      workspaceId: workspaceId,
      memberId: user.uuid,
      spaceLimit: BigInt(0),
      driveUsage: BigInt(0),
      backupsUsage: BigInt(0),
      key: setupWorkspaceDto.encryptedMnemonic,
      deactivated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.workspaceRepository.addUserToWorkspace(workspaceUser);
    await this.teamRepository.addUserToTeam(workspace.defaultTeamId, user.uuid);

    await this.workspaceRepository.updateBy(
      {
        ownerId: user.uuid,
        id: workspaceId,
      },
      {
        name: setupWorkspaceDto.name,
        setupCompleted: true,
        address: setupWorkspaceDto.address,
        description: setupWorkspaceDto.description,
      },
    );
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

    const newTeam = WorkspaceTeam.build({
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
