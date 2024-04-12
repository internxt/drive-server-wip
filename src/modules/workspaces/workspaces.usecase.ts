import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { WorkspaceTeamUser } from './domains/workspace-team-user.domain';
import { UserUseCases } from '../user/user.usecase';
import { WorkspaceInvite } from './domains/workspace-invite.domain';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { MailerService } from '../../externals/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { Sign } from '../../middlewares/passport';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { WorkspaceTeamAttributes } from './attributes/workspace-team.attributes';
import { WorkspaceRole } from './guards/workspace-required-access.decorator';
import { SetupWorkspaceDto } from './dto/setup-workspace.dto';
import { WorkspaceUser } from './domains/workspace-user.domain';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeWorkspaceTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private networkService: BridgeService,
    private userRepository: SequelizeUserRepository,
    private userUsecases: UserUseCases,
    private configService: ConfigService,
    private mailerService: MailerService,
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
    const workspace = await this.workspaceRepository.findOne({
      id: workspaceId,
      ownerId: user.uuid,
      setupCompleted: false,
    });

    if (!workspace) {
      throw new NotFoundException('There is no workspace to be setup');
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

  async inviteUserToWorkspace(
    user: User,
    workspaceId: Workspace['id'],
    createInviteDto: CreateWorkspaceInviteDto,
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    const [existentUser, preCreatedUser] = await Promise.all([
      this.userUsecases.findByEmail(createInviteDto.invitedUser),
      this.userUsecases.findPreCreatedByEmail(createInviteDto.invitedUser),
    ]);

    const userJoining = existentUser ?? preCreatedUser;

    if (!userJoining) {
      throw new NotFoundException('Invited user not found');
    }

    const isUserPreCreated = !existentUser;

    if (!isUserPreCreated) {
      const isUserAlreadyInWorkspace =
        await this.workspaceRepository.findWorkspaceUser({
          workspaceId,
          memberId: userJoining.uuid,
        });
      if (isUserAlreadyInWorkspace) {
        throw new BadRequestException('User is already part of the workspace');
      }
    }

    const invitation = await this.workspaceRepository.findInvite({
      invitedUser: userJoining.uuid,
      workspaceId,
    });
    if (invitation) {
      throw new BadRequestException('User is already invited to workspace');
    }

    const isWorkspaceFull = await this.isWorkspaceFull(workspaceId);

    if (isWorkspaceFull) {
      throw new BadRequestException(
        'You can not invite more users to this workspace',
      );
    }

    const workspaceUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const spaceLeft = await this.getAssignableSpaceInWorkspace(
      workspace,
      workspaceUser,
    );

    if (createInviteDto.spaceLimit > spaceLeft) {
      throw new BadRequestException(
        'Space limit set for the invitation is superior to the space assignable in workspace',
      );
    }

    const newInvite = WorkspaceInvite.build({
      id: v4(),
      workspaceId: workspaceId,
      invitedUser: userJoining.uuid,
      encryptionAlgorithm: createInviteDto.encryptionAlgorithm,
      encryptionKey: createInviteDto.encryptionKey,
      spaceLimit: BigInt(createInviteDto.spaceLimit),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.workspaceRepository.createInvite(newInvite);
    const inviterName = `${user.name} ${user.lastname}`;

    if (isUserPreCreated) {
      const encodedUserEmail = encodeURIComponent(userJoining.email);
      try {
        await this.mailerService.sendWorkspaceUserExternalInvitation(
          inviterName,
          userJoining.email,
          workspace.name,
          `${this.configService.get(
            'clients.drive.web',
          )}/workspace-guest?invitation=${
            newInvite.id
          }&email=${encodedUserEmail}`,
          { initials: user.name[0] + user.lastname[0], pictureUrl: null },
        );
      } catch (error) {
        Logger.error(
          `[WORKSPACE/GUESTUSEREMAIL] Error sending email pre created userId: ${userJoining.uuid}, error: ${error.message}`,
        );
        await this.workspaceRepository.deleteWorkspaceInviteById(newInvite.id);
        throw error;
      }
    } else {
      try {
        const authToken = Sign(
          this.userUsecases.getNewTokenPayload(userJoining),
          this.configService.get('secrets.jwt'),
        );
        await this.mailerService.sendWorkspaceUserInvitation(
          inviterName,
          userJoining.email,
          workspace.name,
          {
            acceptUrl: `${this.configService.get(
              'clients.drive.web',
            )}/workspaces/${newInvite.id}/accept?token=${authToken}`,
            declineUrl: `${this.configService.get(
              'clients.drive.web',
            )}/workspaces/${newInvite.id}/decline?token=${authToken}`,
          },
          { initials: user.name[0] + user.lastname[0], pictureUrl: null },
        );
      } catch (error) {
        Logger.error(
          `[WORKSPACE/USEREMAIL] Error sending email invitation to existent user userId: ${userJoining.uuid}, error: ${error.message}`,
        );
      }
    }

    return newInvite.toJSON();
  }

  async getAssignableSpaceInWorkspace(
    workspace: Workspace,
    workpaceDefaultUser: User,
  ): Promise<bigint> {
    const [
      spaceLimit,
      totalSpaceLimitAssigned,
      totalSpaceAssignedInInvitations,
    ] = await Promise.all([
      this.networkService.getLimit(
        workpaceDefaultUser.bridgeUser,
        workpaceDefaultUser.userId,
      ),
      this.workspaceRepository.getTotalSpaceLimitInWorkspaceUsers(workspace.id),
      this.workspaceRepository.getSpaceLimitInInvitations(workspace.id),
    ]);

    const spaceLeft =
      BigInt(spaceLimit) -
      totalSpaceLimitAssigned -
      totalSpaceAssignedInInvitations;

    return spaceLeft;
  }

  async isWorkspaceFull(workspaceId: Workspace['id']): Promise<boolean> {
    const [workspaceUsersCount, workspaceInvitationsCount] = await Promise.all([
      this.workspaceRepository.getWorkspaceUsersCount(workspaceId),
      this.workspaceRepository.getWorkspaceInvitationsCount(workspaceId),
    ]);

    const limit = 10; // Temporal limit
    const count = workspaceUsersCount + workspaceInvitationsCount;

    return count >= limit;
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

  findUserInWorkspace(
    userUuid: string,
    workspaceId: string,
  ): Promise<{
    workspace: Workspace | null;
    workspaceUser: WorkspaceUser | null;
  }> {
    return this.workspaceRepository.findWorkspaceAndUser(userUuid, workspaceId);
  }

  findById(workspaceId: string): Promise<Workspace | null> {
    return this.workspaceRepository.findById(workspaceId);
  }

  async changeUserRole(
    workspaceId: WorkspaceAttributes['id'],
    teamId: WorkspaceTeamAttributes['id'],
    userUuid: User['uuid'],
    changeUserRoleDto: ChangeUserRoleDto,
  ): Promise<void> {
    const { role } = changeUserRoleDto;

    const [team, teamUser] = await Promise.all([
      this.teamRepository.getTeamById(teamId),
      this.teamRepository.getTeamUser(userUuid, teamId),
    ]);

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    if (!teamUser) {
      throw new NotFoundException('User not part of the team.');
    }

    const user = await this.userRepository.findByUuid(teamUser.memberId);

    if (!user) {
      throw new BadRequestException();
    }

    const isUserAlreadyManager = team.isUserManager(user);

    let newManagerId: UserAttributes['uuid'];

    if (role === WorkspaceRole.MEMBER && isUserAlreadyManager) {
      const workspaceOwner =
        await this.workspaceRepository.findById(workspaceId);
      newManagerId = workspaceOwner.ownerId;
    }

    if (role === WorkspaceRole.MANAGER && !isUserAlreadyManager) {
      newManagerId = user.uuid;
    }

    if (!newManagerId) {
      return;
    }

    await this.teamRepository.updateById(team.id, {
      managerId: newManagerId,
    });
  }

  findUserInTeam(
    userUuid: string,
    teamId: string,
  ): Promise<{
    team: WorkspaceTeam | null;
    teamUser: WorkspaceTeamUser | null;
  }> {
    return this.teamRepository.getTeamUserAndTeamByTeamId(userUuid, teamId);
  }
}
