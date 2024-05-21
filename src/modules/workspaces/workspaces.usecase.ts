import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
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
import { EditTeamDto } from './dto/edit-team-data.dto';
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
import { SequelizeWorkspaceItemsUsersRepository } from './repositories/items-users.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { WorkspaceUserMemberDto } from './dto/workspace-user-member.dto';
import { FileStatus, SortableFileAttributes } from '../file/file.domain';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { FileUseCases } from '../file/file.usecase';
import {
  Folder,
  FolderAttributes,
  SortableFolderAttributes,
} from '../folder/folder.domain';
import {
  WorkspaceItemContext,
  WorkspaceItemType,
} from './attributes/workspace-items-users.attributes';
import { WorkspaceUserAttributes } from './attributes/workspace-users.attributes';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeWorkspaceTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private readonly workspaceItemsUsersRepository: SequelizeWorkspaceItemsUsersRepository,
    private networkService: BridgeService,
    private userRepository: SequelizeUserRepository,
    private userUsecases: UserUseCases,
    private configService: ConfigService,
    private mailerService: MailerService,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
  ) {}

  async initiateWorkspace(
    ownerId: UserAttributes['uuid'],
    maxSpaceBytes: number,
    workspaceData: { address?: string },
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
      name: 'My Workspace',
      address: workspaceData?.address,
      defaultTeamId: newDefaultTeam.id,
      workspaceUserId: workspaceUser.uuid,
      setupCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const bucket = await this.networkService.createBucket(
        workspaceEmail,
        networkUserId,
      );
      const rootFolder = await this.folderUseCases.createRootFolder(
        workspaceUser,
        v4(),
        bucket.id,
      );
      newWorkspace.rootFolderId = rootFolder.uuid;

      await this.userRepository.updateBy(
        { uuid: workspaceUser.uuid },
        { rootFolderId: rootFolder.id },
      );

      await this.teamRepository.createTeam(newDefaultTeam);
      await this.workspaceRepository.create(newWorkspace);
      await this.teamRepository.updateById(newDefaultTeam.id, { workspaceId });

      return {
        workspace: newWorkspace,
      };
    } catch (error) {
      Logger.log(
        `[WORKSPACES/INITIATE]: An error has ocurred while initializing a workspace userId: ${ownerId} error: ${error.message}`,
      );
      throw error;
    }
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
      throw new NotFoundException('Workspace not found');
    }

    const [userAlreadyInWorkspace, userAlreadyInDefaultTeam] =
      await Promise.all([
        this.workspaceRepository.findWorkspaceUser({
          workspaceId: workspace.id,
          memberId: user.uuid,
        }),
        this.teamRepository.getTeamUser(user.uuid, workspace.defaultTeamId),
      ]);

    try {
      if (!userAlreadyInWorkspace) {
        const rootFolder = await this.initiateWorkspacePersonalRootFolder(
          workspace.workspaceUserId,
          workspace.rootFolderId,
        );

        const workspaceUser = WorkspaceUser.build({
          id: v4(),
          workspaceId: workspace.id,
          memberId: user.uuid,
          spaceLimit: BigInt(0),
          driveUsage: BigInt(0),
          backupsUsage: BigInt(0),
          key: setupWorkspaceDto.encryptedMnemonic,
          rootFolderId: rootFolder.uuid,
          deactivated: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await this.workspaceRepository.addUserToWorkspace(workspaceUser);

        await this.workspaceRepository.createItem({
          itemId: rootFolder.uuid,
          workspaceId: workspace.id,
          itemType: WorkspaceItemType.Folder,
          context: WorkspaceItemContext.Drive,
          createdBy: user.uuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (!userAlreadyInDefaultTeam) {
        await this.teamRepository.addUserToTeam(
          workspace.defaultTeamId,
          user.uuid,
        );
      }
    } catch (error) {
      let finalMessage =
        'There was a problem setting this user in the workspace! ';
      const rollbackError = await this.rollbackUserAddedToWorkspace(
        user.uuid,
        workspace,
      );

      finalMessage += rollbackError
        ? rollbackError.message
        : 'rollback applied successfully';

      Logger.error(
        `[WORKSPACE/SETUP]: error while setting workspace User! ${
          (error as Error).message
        }`,
      );

      throw new InternalServerErrorException(finalMessage);
    }

    const workspaceUpdatedInfo: Partial<WorkspaceAttributes> = {
      name: setupWorkspaceDto.name ?? workspace.name,
      setupCompleted: true,
      address: setupWorkspaceDto.address ?? workspace.address,
      description: setupWorkspaceDto.description ?? workspace.description,
    };

    await this.workspaceRepository.updateBy(
      {
        ownerId: user.uuid,
        id: workspace.id,
      },
      workspaceUpdatedInfo,
    );
  }

  async rollbackUserAddedToWorkspace(
    userUuid: User['uuid'],
    workspace: Workspace,
  ): Promise<Error | null> {
    try {
      await this.workspaceRepository.deleteUserFromWorkspace(
        userUuid,
        workspace.id,
      );

      await this.teamRepository.deleteUserFromTeam(
        userUuid,
        workspace.defaultTeamId,
      );

      return null;
    } catch (err) {
      Logger.error(
        `[WORKSPACE/ROLLBACK_USER_ADDED]User Added to workspace rollback failed user: ${userUuid} workspaceId: ${
          workspace.id
        } error: ${(err as Error).message}`,
      );
      return new Error('User added to workspace rollback failed');
    }
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

  async createFile(
    member: User,
    workspaceId: string,
    createFileDto: CreateWorkspaceFileDto,
  ) {
    const workspaceUser = await this.workspaceRepository.findWorkspaceUser({
      memberId: member.uuid,
      workspaceId,
    });

    if (!workspaceUser.hasEnoughSpaceForFile(createFileDto.size)) {
      throw new BadRequestException('You have not enough space for this file');
    }

    const workspace = await this.workspaceRepository.findById(workspaceId);

    const parentFolder = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId: createFileDto.folderUuid,
      itemType: WorkspaceItemType.Folder,
    });

    if (!parentFolder) {
      throw new BadRequestException('Parent folder is not valid');
    }

    const isParentFolderWorkspaceRootFolder =
      createFileDto.folderUuid === workspace.rootFolderId;

    if (!parentFolder.isOwnedBy(member) || isParentFolderWorkspaceRootFolder) {
      throw new ForbiddenException('You can not create a file here');
    }

    const networkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const createdFile = await this.fileUseCases.createFile(
      networkUser,
      createFileDto,
    );

    const createdItemFile = await this.workspaceRepository.createItem({
      itemId: createdFile.uuid,
      workspaceId,
      itemType: WorkspaceItemType.File,
      context: WorkspaceItemContext.Drive,
      createdBy: member.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    workspaceUser.addDriveUsage(BigInt(createdFile.size));

    await this.workspaceRepository.updateWorkspaceUser(
      workspaceUser.id,
      workspaceUser,
    );

    return { ...createdFile, item: createdItemFile };
  }

  async createFolder(
    user: User,
    workspaceId: string,
    createFolderDto: CreateWorkspaceFolderDto,
  ) {
    const { parentFolderUuid } = createFolderDto;

    const workspace = await this.workspaceRepository.findById(workspaceId);

    const parentFolder = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId: parentFolderUuid,
      itemType: WorkspaceItemType.Folder,
    });

    if (!parentFolder) {
      throw new BadRequestException('Parent folder is not valid');
    }

    const isParentFolderWorkspaceRootFolder =
      parentFolderUuid === workspace.rootFolderId;

    if (!parentFolder.isOwnedBy(user) || isParentFolderWorkspaceRootFolder) {
      throw new ForbiddenException('You can not create a folder here');
    }

    const networkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const createdFolder = await this.folderUseCases.createFolder(
      networkUser,
      createFolderDto.name,
      parentFolderUuid,
    );

    const createdItemFolder = await this.workspaceRepository.createItem({
      itemId: createdFolder.uuid,
      workspaceId,
      itemType: WorkspaceItemType.Folder,
      context: WorkspaceItemContext.Drive,
      createdBy: user.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { ...createdFolder, item: createdItemFolder };
  }

  async getPersonalWorkspaceFoldersInFolder(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    folderUuid: FolderAttributes['uuid'],
    limit = 100,
    offset = 0,
    options?: { sort: SortableFolderAttributes; order },
  ) {
    const folder = await this.folderUseCases.getByUuid(folderUuid);

    if (!folder) {
      throw new BadRequestException('Folder is not valid');
    }

    const parentFolder = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId: folder.uuid,
      itemType: WorkspaceItemType.Folder,
    });

    if (!parentFolder?.isOwnedBy(user)) {
      throw new ForbiddenException('You have no access to this folder');
    }

    const folders = await this.folderUseCases.getFoldersWithParentInWorkspace(
      user.uuid,
      {
        parentId: folder.id,
        deleted: false,
        removed: false,
      },
      {
        limit,
        offset,
        sort: options?.sort &&
          options?.order && [[options.sort, options.order]],
      },
    );

    return {
      result: folders.map((f) => ({ ...f, status: FileStatus.EXISTS })),
    };
  }

  async getPersonalWorkspaceFilesInFolder(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    folderUuid: FolderAttributes['uuid'],
    limit = 100,
    offset = 0,
    options?: {
      sort: SortableFileAttributes;
      order;
    },
  ) {
    const folder = await this.folderUseCases.getByUuid(folderUuid);

    if (!folder) {
      throw new BadRequestException('Folder is not valid');
    }

    const folderInWorkspace = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId: folder.uuid,
      itemType: WorkspaceItemType.Folder,
    });

    if (!folderInWorkspace?.isOwnedBy(user)) {
      throw new ForbiddenException('You have no access to this folder');
    }

    const files = await this.fileUseCases.getFilesInWorkspace(
      user.uuid,
      {
        folderId: folder.id,
        status: FileStatus.EXISTS,
      },
      {
        limit,
        offset,
        sort: options?.sort &&
          options?.order && [[options.sort, options.order]],
      },
    );

    return {
      result: files,
    };
  }

  async acceptWorkspaceInvite(user: User, inviteId: WorkspaceInvite['id']) {
    const invite = await this.workspaceRepository.findInvite({
      id: inviteId,
      invitedUser: user.uuid,
    });

    if (!invite) {
      throw new BadRequestException('This invitation is not valid');
    }

    const workspace = await this.workspaceRepository.findOne({
      id: invite.workspaceId,
      setupCompleted: true,
    });

    if (!workspace) {
      throw new BadRequestException(
        'This invitation does not have a valid workspace',
      );
    }

    const userAlreadyInWorkspace =
      await this.workspaceRepository.findWorkspaceUser({
        workspaceId: workspace.id,
        memberId: user.uuid,
      });

    if (userAlreadyInWorkspace) {
      await this.workspaceRepository.deleteInviteBy({ id: invite.id });
      return userAlreadyInWorkspace.toJSON();
    }

    try {
      const rootFolder = await this.initiateWorkspacePersonalRootFolder(
        workspace.workspaceUserId,
        workspace.rootFolderId,
      );

      const workspaceUser = WorkspaceUser.build({
        id: v4(),
        workspaceId: invite.workspaceId,
        memberId: invite.invitedUser,
        spaceLimit: invite.spaceLimit,
        driveUsage: BigInt(0),
        rootFolderId: rootFolder.uuid,
        backupsUsage: BigInt(0),
        key: invite.encryptionKey,
        deactivated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.workspaceRepository.addUserToWorkspace(workspaceUser);

      await this.teamRepository.addUserToTeam(
        workspace.defaultTeamId,
        user.uuid,
      );

      await this.workspaceRepository.createItem({
        itemId: rootFolder.uuid,
        workspaceId: workspace.id,
        itemType: WorkspaceItemType.Folder,
        context: WorkspaceItemContext.Drive,
        createdBy: user.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.workspaceRepository.deleteInviteBy({ id: invite.id });

      return workspaceUser.toJSON();
    } catch (error) {
      let finalMessage = 'There was a problem accepting this invite! ';
      const rollbackError = await this.rollbackUserAddedToWorkspace(
        user.uuid,
        workspace,
      );

      finalMessage += rollbackError
        ? rollbackError.message
        : 'rollback applied successfully';

      Logger.error(
        `[WORKSPACE/ACEPT_INVITE]: Error while accepting user invitation! ${
          (error as Error).message
        }`,
      );

      throw new InternalServerErrorException(finalMessage);
    }
  }

  async initiateWorkspacePersonalRootFolder(
    workspaceUserId: WorkspaceAttributes['workspaceUserId'],
    workspaceRootFolderId: WorkspaceAttributes['rootFolderId'],
  ): Promise<Folder> {
    const workspaceNetworkUser =
      await this.userRepository.findByUuid(workspaceUserId);

    const rootFolder = await this.folderUseCases.createFolder(
      workspaceNetworkUser,
      v4(),
      workspaceRootFolderId,
    );

    return rootFolder;
  }

  async removeWorkspaceInvite(user: User, inviteId: WorkspaceInvite['id']) {
    const invite = await this.workspaceRepository.findInvite({
      id: inviteId,
    });

    if (!invite) {
      throw new BadRequestException('Invalid invite');
    }

    const workspace = await this.workspaceRepository.findOne({
      id: invite.workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Invalid invite');
    }

    const isInvitedUser = user.uuid === invite.invitedUser;

    if (!workspace.isUserOwner(user) && !isInvitedUser) {
      throw new ForbiddenException();
    }

    await this.workspaceRepository.deleteInviteBy({
      id: invite.id,
    });
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

    const teamInWorkspaceCount =
      await this.teamRepository.getTeamsInWorkspaceCount(workspace.id);

    if (teamInWorkspaceCount >= 10) {
      throw new BadRequestException('Maximum teams reached');
    }

    const managerId = createTeamDto.managerId
      ? createTeamDto.managerId
      : user.uuid;

    const isUserAlreadyInWorkspace =
      await this.workspaceRepository.findWorkspaceUser({
        workspaceId: workspace.id,
        memberId: managerId,
      });

    if (!isUserAlreadyInWorkspace) {
      throw new BadRequestException(
        'User Manager is not part of the workspace',
      );
    }

    const newTeam = WorkspaceTeam.build({
      id: v4(),
      workspaceId: workspaceId,
      name: createTeamDto.name,
      managerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createdTeam = await this.teamRepository.createTeam(newTeam);

    await this.teamRepository.addUserToTeam(createdTeam.id, managerId);

    return createdTeam;
  }

  async getAvailableWorkspaces(user: User) {
    const [availablesWorkspaces, ownerPendingWorkspaces] = await Promise.all([
      await this.workspaceRepository.findUserAvailableWorkspaces(user.uuid),
      await this.getWorkspacesPendingToBeSetup(user),
    ]);

    return {
      availableWorkspaces: availablesWorkspaces.filter(
        ({ workspace, workspaceUser }) =>
          workspace.isWorkspaceReady() && !workspaceUser.deactivated,
      ),
      pendingWorkspaces: ownerPendingWorkspaces,
    };
  }

  async getWorkspacesPendingToBeSetup(user: User) {
    const workspacesToBeSetup = await this.workspaceRepository.findAllBy({
      ownerId: user.uuid,
      setupCompleted: false,
    });

    return workspacesToBeSetup;
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

  async getWorkspaceMembers(
    workspaceId: WorkspaceAttributes['id'],
    user: User,
  ) {
    const workspace = await this.workspaceRepository.findOne({
      ownerId: user.uuid,
      id: workspaceId,
    });
    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const workspaceUsers = await this.workspaceRepository.findWorkspaceUsers(
      workspace.id,
    );

    const teamsInWorkspace = await this.teamRepository.getTeamsInWorkspace(
      workspace.id,
    );

    const workspaceUserMembers: WorkspaceUserMemberDto[] = await Promise.all(
      workspaceUsers.map(async (workspaceUser) => {
        if (workspaceUser.member && workspaceUser.member.avatar) {
          const resAvatarUrl = await this.userUsecases.getAvatarUrl(
            workspaceUser.member.avatar,
          );

          workspaceUser.member.avatar =
            typeof resAvatarUrl == 'object' ? null : resAvatarUrl;
        }

        const isOwner = workspace.ownerId == workspaceUser.memberId;
        const isManager = teamsInWorkspace.some(
          (team) => team.managerId == workspaceUser.memberId,
        );

        return {
          isOwner,
          isManager,
          usedSpace: workspaceUser.getUsedSpace().toString(),
          freeSpace: workspaceUser.getFreeSpace().toString(),
          ...workspaceUser.toJSON(),
        };
      }),
    );

    return {
      activatedUsers: workspaceUserMembers.filter(
        (workspaceUserMember) => workspaceUserMember.deactivated == false,
      ),
      disabledUsers: workspaceUserMembers.filter(
        (workspaceUserMember) => workspaceUserMember.deactivated == true,
      ),
    };
  }

  async getTeamMembers(
    teamId: WorkspaceTeam['id'],
  ): Promise<Pick<User, 'uuid' | 'email' | 'name' | 'lastname' | 'avatar'>[]> {
    const members = await this.teamRepository.getTeamMembers(teamId);

    const membersInfo = await Promise.all(
      members.map(async (member) => ({
        name: member.name,
        lastname: member.lastname,
        email: member.email,
        id: member.id,
        uuid: member.uuid,
        avatar: member.avatar
          ? await this.userUsecases.getAvatarUrl(member.avatar)
          : null,
      })),
    );

    return membersInfo;
  }

  async editTeamData(teamId: WorkspaceTeam['id'], editTeamDto: EditTeamDto) {
    await this.getAndValidateNonDefaultTeamWorkspace(teamId);

    await this.teamRepository.updateById(teamId, editTeamDto);
  }

  async removeMemberFromTeam(
    teamId: WorkspaceTeam['id'],
    memberId: User['uuid'],
  ) {
    const { team } = await this.getAndValidateNonDefaultTeamWorkspace(teamId);

    const teamUser = await this.teamRepository.getTeamUser(memberId, team.id);

    if (!teamUser) {
      throw new BadRequestException('User is not part of team!');
    }

    const isUserManagerOfTeam = team.managerId === memberId;

    if (isUserManagerOfTeam) {
      const teamWorkspace = await this.workspaceRepository.findOne({
        id: team.workspaceId,
      });

      await this.teamRepository.updateById(team.id, {
        managerId: teamWorkspace.ownerId,
      });
    }

    await this.teamRepository.removeMemberFromTeam(teamId, memberId);
  }

  async addMemberToTeam(teamId: WorkspaceTeam['id'], memberId: User['uuid']) {
    const { team } = await this.getAndValidateNonDefaultTeamWorkspace(teamId);

    const workspaceUser = await this.workspaceRepository.findWorkspaceUser({
      memberId,
      deactivated: false,
    });

    if (!workspaceUser) {
      throw new BadRequestException(
        'This user is not valid member in the workspace',
      );
    }

    const userAlreadyInTeam = await this.teamRepository.getTeamUser(
      memberId,
      team.id,
    );

    if (userAlreadyInTeam) {
      throw new BadRequestException('This user is already part of team!');
    }

    const membersCount = await this.teamRepository.getTeamMembersCount(teamId);

    if (membersCount >= 20) {
      throw new BadRequestException('Maximum members reached');
    }

    const newMember = await this.teamRepository.addUserToTeam(teamId, memberId);

    return newMember;
  }

  async getMemberDetails(
    workspaceId: WorkspaceAttributes['id'],
    memberId: User['uuid'],
  ) {
    const [workspaceUser, user] = await Promise.all([
      this.workspaceRepository.findWorkspaceUser({
        workspaceId: workspaceId,
        memberId,
      }),
      this.userRepository.findByUuid(memberId),
    ]);

    if (!workspaceUser || !user) {
      throw new NotFoundException('User was not found');
    }

    const workspaceTeamUser =
      await this.teamRepository.getTeamAndMemberByWorkspaceAndMemberId(
        workspaceId,
        workspaceUser.memberId,
      );

    return {
      user: {
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        uuid: user.uuid,
        id: user.id,
        avatar: user.avatar
          ? await this.userUsecases.getAvatarUrl(user.avatar)
          : null,
        memberId: workspaceUser.memberId,
        workspaceId: workspaceUser.workspaceId,
        spaceLimit: workspaceUser.spaceLimit.toString(),
        driveUsage: workspaceUser.driveUsage.toString(),
        backupsUsage: workspaceUser.backupsUsage.toString(),
        deactivated: workspaceUser.deactivated,
      },
      teams: workspaceTeamUser.map((teamUserData) => ({
        ...teamUserData.team,
        isManager: teamUserData.team.isUserManager(user),
      })),
    };
  }

  async getAndValidateNonDefaultTeamWorkspace(teamId: string) {
    const team = await this.teamRepository.getTeamById(teamId);

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    const workspace = await this.workspaceRepository.findOne({
      id: team.workspaceId,
    });

    if (!workspace) {
      throw new ForbiddenException('Not valid workspace found');
    }

    if (workspace.isDefaultTeam(team)) {
      throw new BadRequestException('Invalid operation on default team');
    }

    return { team, workspace };
  }

  async deactivateWorkspaceUser(
    user: User,
    memberId: WorkspaceUserAttributes['memberId'],
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const { workspace, workspaceUser } =
      await this.workspaceRepository.findWorkspaceAndUser(
        memberId,
        workspaceId,
      );

    if (!workspace || !workspaceUser) {
      throw new BadRequestException('This user is not part of workspace');
    }

    if (workspace.isUserOwner(user)) {
      throw new BadRequestException(
        'You can not deactivate the owner of the workspace',
      );
    }

    await this.workspaceRepository.deactivateWorkspaceUser(
      workspaceUser.memberId,
      workspace.id,
    );
  }

  async changeTeamManager(
    teamId: WorkspaceTeam['id'],
    managerId: User['uuid'],
  ) {
    const { team } = await this.getAndValidateNonDefaultTeamWorkspace(teamId);

    const workspaceUser = await this.workspaceRepository.findWorkspaceUser({
      memberId: managerId,
      deactivated: false,
    });

    if (!workspaceUser) {
      throw new BadRequestException(
        'The user you are trying to assign as manager is not a valid member in the workspace',
      );
    }

    const teamUser = await this.teamRepository.getTeamUser(managerId, team.id);

    if (!teamUser) {
      throw new BadRequestException('User is not in the team');
    }

    await this.teamRepository.updateById(team.id, { managerId });
  }

  async deleteTeam(teamId: WorkspaceTeam['id']) {
    await this.getAndValidateNonDefaultTeamWorkspace(teamId);

    await this.teamRepository.deleteTeamById(teamId);
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

  async deleteWorkspaceContent(
    workspaceId: Workspace['id'],
    user: User,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!workspace.isUserOwner(user)) {
      throw new ForbiddenException('You are not the owner of this workspace');
    }
    const items =
      await this.workspaceItemsUsersRepository.getAllByWorkspaceId(workspaceId);

    const itemsDeletionChunkSize = 10;

    const fileIds = items
      .filter((item) => item.itemType === 'file')
      .map((item) => parseInt(item.itemId));
    const folderIds = items
      .filter((item) => item.itemType === 'folder')
      .map((item) => parseInt(item.itemId));

    const files =
      fileIds.length > 0
        ? await this.fileUseCases.getFilesByIds(user, fileIds)
        : [];
    const folders =
      folderIds.length > 0
        ? await this.folderUseCases.getFoldersByIds(user, folderIds)
        : [];

    for (let i = 0; i < files.length; i += itemsDeletionChunkSize) {
      await this.fileUseCases.delete(
        files.slice(i, i + itemsDeletionChunkSize),
      );
    }

    for (let i = 0; i < folders.length; i += itemsDeletionChunkSize) {
      await this.folderUseCases.delete(
        folders.slice(i, i + itemsDeletionChunkSize),
      );
    }

    await this.workspaceRepository.deleteById(workspaceId);
  }

  async leaveWorkspace(
    user: User,
    workspaceId: Workspace['id'],
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.isUserOwner(user)) {
      throw new BadRequestException('Owner can not simply leave workspace');
    }

    const userInWorkspace = await this.workspaceRepository.findWorkspaceUser({
      workspaceId,
      memberId: user.uuid,
    });

    if (!userInWorkspace) {
      throw new BadRequestException('User is not in the workspace');
    }

    const userItemsInWorkspace =
      await this.workspaceItemsUsersRepository.getAllByUserAndWorkspaceId(
        user,
        workspaceId,
      );

    if (userItemsInWorkspace.length > 0) {
      throw new BadRequestException('User has items in the workspace');
    }

    const teamsUserManages =
      await this.teamRepository.getTeamsWhereUserIsManagerByWorkspaceId(
        workspaceId,
        user,
      );

    for (const team of teamsUserManages) {
      await this.teamRepository.updateById(team.id, {
        managerId: workspace.ownerId,
      });
      await this.teamRepository.deleteUserFromTeam(user.uuid, team.id);
    }

    await this.workspaceRepository.deleteUserFromWorkspace(
      user.uuid,
      workspaceId,
    );
  }
}
