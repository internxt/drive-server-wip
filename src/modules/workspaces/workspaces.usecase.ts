import {
  BadRequestException,
  ConflictException,
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
import { EditWorkspaceDetailsDto } from './dto/edit-workspace-details-dto';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { FolderUseCases } from '../folder/folder.usecase';
import { WorkspaceUserMemberDto } from './dto/workspace-user-member.dto';
import { File, FileStatus, SortableFileAttributes } from '../file/file.domain';
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
  WorkspaceItemUserAttributes,
} from './attributes/workspace-items-users.attributes';
import { WorkspaceUserAttributes } from './attributes/workspace-users.attributes';
import {
  SharedWithType,
  Sharing,
  SharingType,
} from '../sharing/sharing.domain';
import { ShareItemWithTeamDto } from './dto/share-item-with-team.dto';
import {
  generateTokenWithPlainSecret,
  generateWithDefaultSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import { WorkspaceItemUser } from './domains/workspace-item-user.domain';
import { SharingService } from '../sharing/sharing.service';
import { ChangeUserAssignedSpaceDto } from './dto/change-user-assigned-space.dto';
import { PaymentsService } from '../../externals/payments/payments.service';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeWorkspaceTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private readonly sharingUseCases: SharingService,
    private readonly paymentService: PaymentsService,
    private networkService: BridgeService,
    private userRepository: SequelizeUserRepository,
    private userUsecases: UserUseCases,
    private configService: ConfigService,
    private mailerService: MailerService,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private readonly avatarService: AvatarService,
  ) {}

  async initiateWorkspace(
    ownerId: UserAttributes['uuid'],
    maxSpaceBytes: number,
    workspaceData: {
      address?: string;
      numberOfSeats: number;
      phoneNumber?: string;
    },
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
      numberOfSeats: workspaceData.numberOfSeats,
      phoneNumber: workspaceData?.phoneNumber,
      avatar: null,
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

  async getWorkspaceDetails(workspaceId: Workspace['id']) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace.toJSON();
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

        const fixedSpaceLimit =
          await this.getWorkspaceFixedStoragePerUser(workspace);

        const workspaceUser = WorkspaceUser.build({
          id: v4(),
          workspaceId: workspace.id,
          memberId: user.uuid,
          spaceLimit: fixedSpaceLimit,
          driveUsage: 0,
          backupsUsage: 0,
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

  async getWorkspaceFixedStoragePerUser(workspace: Workspace) {
    const workspaceTotalLimit = await this.getWorkspaceNetworkLimit(workspace);

    return Math.floor(workspaceTotalLimit / workspace.numberOfSeats);
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

    const isWorkspaceFull = await this.isWorkspaceFull(workspace);

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

    const fixedSpaceLimit =
      await this.getWorkspaceFixedStoragePerUser(workspace);

    if (fixedSpaceLimit > spaceLeft) {
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
      spaceLimit: fixedSpaceLimit,
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
          {
            avatar: {
              initials: user.name[0] + user.lastname[0],
              pictureUrl: null,
            },
            message: createInviteDto.message,
          },
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
          {
            avatar: {
              initials: user.name[0] + user.lastname[0],
              pictureUrl: null,
            },
            message: createInviteDto.message,
          },
        );
      } catch (error) {
        Logger.error(
          `[WORKSPACE/USEREMAIL] Error sending email invitation to existent user userId: ${userJoining.uuid}, error: ${error.message}`,
        );
      }
    }

    return newInvite.toJSON();
  }

  async changeUserAssignedSpace(
    workspaceId: Workspace['id'],
    memberId: WorkspaceUser['memberId'],
    changeAssignedSpace: ChangeUserAssignedSpaceDto,
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    const member = await this.workspaceRepository.findWorkspaceUser({
      memberId,
      workspaceId,
    });

    if (!member) {
      throw new BadRequestException('Member does not exist in this workspace');
    }

    const workspaceUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const spaceLeft = await this.getAssignableSpaceInWorkspace(
      workspace,
      workspaceUser,
    );

    const newSpaceLimit = changeAssignedSpace.spaceLimit;
    const currentSpaceLimit = member.spaceLimit;
    const spaceLeftWithoutUser = spaceLeft + currentSpaceLimit;

    if (newSpaceLimit > spaceLeftWithoutUser) {
      throw new BadRequestException(
        `Space limit set for the invitation is superior to the space assignable in workspace. Assignable space: ${spaceLeftWithoutUser}`,
      );
    }

    if (member.getUsedSpace() >= newSpaceLimit) {
      throw new BadRequestException(
        'The space you are trying to assign to the user is less than the user already used space',
      );
    }

    member.spaceLimit = changeAssignedSpace.spaceLimit;

    this.workspaceRepository.updateWorkspaceUser(member.id, member);

    return member.toJSON();
  }

  async getWorkspaceUserTrashedItems(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    itemType: WorkspaceItemUserAttributes['itemType'],
    limit = 50,
    offset = 0,
  ) {
    let result: File[] | Folder[];

    if (itemType === WorkspaceItemType.File) {
      result = await this.fileUseCases.getFilesInWorkspace(
        user.uuid,
        workspaceId,
        {
          status: FileStatus.TRASHED,
        },
        {
          limit,
          offset,
        },
      );
    } else {
      result = await this.folderUseCases.getFoldersInWorkspace(
        user.uuid,
        workspaceId,
        {
          deleted: true,
          removed: false,
        },
        {
          limit,
          offset,
        },
      );
    }

    return { result };
  }

  async getUserUsageInWorkspace(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const member = await this.workspaceRepository.findWorkspaceUser({
      memberId: user.uuid,
      workspaceId,
    });

    if (!member) {
      throw new BadRequestException('User not valid');
    }

    const syncStartedAt = new Date();

    const [totalUsedDrive, totalDeletedSize] = await Promise.all([
      this.calculateFilesSizeSum(
        user.uuid,
        workspaceId,
        [FileStatus.EXISTS, FileStatus.TRASHED],
        member.lastUsageSyncAt,
      ),
      this.calculateFilesSizeSum(
        user.uuid,
        workspaceId,
        [FileStatus.DELETED],
        member.lastUsageSyncAt,
        'removedFrom',
      ),
    ]);

    member.driveUsage =
      Math.max(member.driveUsage - totalDeletedSize, 0) + totalUsedDrive;

    member.lastUsageSyncAt = syncStartedAt;

    await this.workspaceRepository.updateWorkspaceUser(member.id, member);

    return {
      driveUsage: member.driveUsage,
      backupsUsage: member.backupsUsage,
      spaceLimit: member.spaceLimit,
    };
  }

  async calculateFilesSizeSum(
    userId: User['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    statuses: FileStatus[],
    dateFrom: Date | null,
    dateField: 'createdFrom' | 'removedFrom' = 'createdFrom',
  ): Promise<number> {
    const calculateUsageChunkSize = 100;
    let filesFetched;

    let offset = 0;
    let totalSize = 0;

    do {
      const sizesChunk =
        await this.fileUseCases.getWorkspaceFilesSizeSumByStatuses(
          userId,
          workspaceId,
          statuses,
          {
            limit: calculateUsageChunkSize,
            offset,
            [dateField]: dateFrom,
          },
        );

      filesFetched = sizesChunk.length;

      const filesSize = sizesChunk.reduce(
        (sum, file) => sum + Number(file.size),
        0,
      );

      totalSize += filesSize;
      offset += calculateUsageChunkSize;
    } while (filesFetched !== 0);

    return totalSize;
  }

  async emptyUserTrashedItems(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const emptyTrashItems = async (
      itemCount: number,
      chunkSize: number,
      getItems: (offset: number) => Promise<any[]>,
      deleteItems: (items: (File | Folder)[]) => Promise<void>,
    ) => {
      const promises = [];
      for (let i = 0; i < itemCount; i += chunkSize) {
        const items = await getItems(i);
        promises.push(deleteItems(items));
      }
      await Promise.all(promises);
    };

    const [filesCount, foldersCount] = await Promise.all([
      this.workspaceRepository.getItemFilesCountBy(
        {
          createdBy: user.uuid,
          workspaceId,
        },
        { status: FileStatus.TRASHED },
      ),
      this.workspaceRepository.getItemFoldersCountBy(
        {
          createdBy: user.uuid,
          workspaceId,
        },
        { removed: false, deleted: true },
      ),
    ]);

    const workspaceUser =
      await this.workspaceRepository.findWorkspaceResourcesOwner(workspaceId);

    const emptyTrashChunkSize = 100;

    await emptyTrashItems(
      foldersCount,
      emptyTrashChunkSize,
      (offset) =>
        this.folderUseCases.getFoldersInWorkspace(
          user.uuid,
          workspaceId,
          { deleted: true, removed: false },
          { limit: emptyTrashChunkSize, offset },
        ),
      (folders: Folder[]) =>
        this.folderUseCases.deleteByUser(workspaceUser, folders),
    );

    await emptyTrashItems(
      filesCount,
      emptyTrashChunkSize,
      (offset) =>
        this.fileUseCases.getFilesInWorkspace(
          user.uuid,
          workspaceId,
          { status: FileStatus.TRASHED },
          { limit: emptyTrashChunkSize, offset },
        ),
      (files: File[]) => this.fileUseCases.deleteByUser(workspaceUser, files),
    );
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

    if (!workspaceUser.hasEnoughSpaceForFile(Number(createFileDto.size))) {
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

    workspaceUser.addDriveUsage(Number(createdFile.size));

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

    const folders = await this.folderUseCases.getFoldersInWorkspace(
      user.uuid,
      workspaceId,
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
      workspaceId,
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

  async shareItemWithTeam(
    user: User,
    workspaceId: string,
    shareWithTeamDto: ShareItemWithTeamDto,
  ) {
    const { itemType, itemId } = shareWithTeamDto;

    const item = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId,
      itemType,
    });

    if (!item) {
      throw new NotFoundException('Item was not found');
    }

    if (!item.isOwnedBy(user)) {
      throw new ForbiddenException('You can not share this item');
    }

    const team = await this.teamRepository.getTeamById(
      shareWithTeamDto.sharedWith,
    );

    if (!team) {
      throw new BadRequestException('Team is not valid');
    }

    const [existentSharing, workspace] = await Promise.all([
      this.sharingUseCases.findSharingBy({
        sharedWithType: SharedWithType.WorkspaceTeam,
        sharedWith: team.id,
        itemId: item.itemId,
        itemType: item.itemType,
      }),
      this.workspaceRepository.findById(workspaceId),
    ]);

    if (!workspace) {
      throw new BadRequestException('Workspace is not valid!');
    }

    if (existentSharing) {
      throw new ConflictException(
        'This item is already shared with this team!',
      );
    }

    const sharing = Sharing.build({
      id: v4(),
      sharedWithType: SharedWithType.WorkspaceTeam,
      sharedWith: team.id,
      itemId: item.itemId,
      itemType: item.itemType,
      ownerId: workspace.workspaceUserId,
      encryptionKey: '',
      encryptionAlgorithm: '',
      type: SharingType.Private,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createdSharing = this.sharingUseCases.createSharing(
      sharing,
      shareWithTeamDto.roleId,
    );

    return createdSharing;
  }

  async getItemsInSharedFolder(
    workspaceId: Workspace['id'],
    teamId: WorkspaceTeam['id'],
    user: User,
    folderUuid: Folder['uuid'],
    itemsType: WorkspaceItemType,
    token: string | null,
    options?: { page: number; perPage: number; order: string[][] },
  ) {
    const getFolderContentByCreatedBy = async (
      createdBy: User['uuid'],
      folderUuid: Folder['uuid'],
    ) => {
      const folders = (
        await this.folderUseCases.getFoldersInWorkspace(
          createdBy,
          workspaceId,
          {
            parentUuid: folderUuid,
            deleted: false,
            removed: false,
          },
          {
            limit: options?.perPage,
            offset: options?.page * options?.perPage,
          },
        )
      ).map((folder) => {
        return {
          ...folder,
          encryptionKey: null,
          dateShared: null,
          sharedWithMe: null,
        };
      });

      return folders;
    };

    const getFilesFromFolder = async (
      createdBy: User['uuid'],
      folderUuid: Folder['uuid'],
    ) => {
      const files = (
        await this.fileUseCases.getFilesInWorkspace(
          createdBy,
          workspaceId,
          {
            folderUuid: folderUuid,
            status: FileStatus.EXISTS,
          },
          {
            limit: options?.perPage,
            offset: options?.page * options?.perPage,
          },
        )
      ).map((file) => {
        return {
          ...file,
          encryptionKey: null,
          dateShared: null,
          sharedWithMe: null,
        };
      });

      return files;
    };

    const folder = await this.folderUseCases.getByUuid(folderUuid);

    if (folder.isTrashed()) {
      throw new BadRequestException('This folder is trashed');
    }

    if (folder.isRemoved()) {
      throw new BadRequestException('This folder is removed');
    }

    const itemFolder = await this.workspaceRepository.getItemBy({
      itemId: folderUuid,
      itemType: WorkspaceItemType.Folder,
      workspaceId: workspaceId,
    });

    if (!itemFolder) {
      throw new NotFoundException('Item not found in workspace');
    }

    const parentFolder = folder.parentUuid
      ? await this.folderUseCases.getByUuid(folder.parentUuid)
      : null;

    if (itemFolder.isOwnedBy(user)) {
      return {
        items:
          itemsType === WorkspaceItemType.Folder
            ? await getFolderContentByCreatedBy(
                itemFolder.createdBy,
                folder.uuid,
              )
            : await getFilesFromFolder(itemFolder.createdBy, folder.uuid),
        name: folder.plainName,
        bucket: '',
        encryptionKey: null,
        token: '',
        parent: {
          uuid: parentFolder?.uuid || null,
          name: parentFolder?.plainName || null,
        },
        role: 'OWNER',
      };
    }

    const requestedFolderIsSharedRootFolder = !token;

    const decoded = requestedFolderIsSharedRootFolder
      ? null
      : (verifyWithDefaultSecret(token) as
          | {
              sharedRootFolderId: Folder['uuid'];
              sharedWithType: SharedWithType;
              parentFolderId: Folder['parent']['uuid'];
              folder: {
                uuid: Folder['uuid'];
                id: Folder['id'];
              };
              workspace: {
                workspaceId: Workspace['id'];
                teamId: WorkspaceTeam['id'];
              };
              owner: {
                id: User['id'];
                uuid: User['uuid'];
              };
            }
          | string);

    if (typeof decoded === 'string') {
      throw new ForbiddenException('Invalid token');
    }

    const sharing = await this.sharingUseCases.findSharingBy({
      sharedWith: teamId,
      itemId: requestedFolderIsSharedRootFolder
        ? folderUuid
        : decoded.sharedRootFolderId,
      sharedWithType: SharedWithType.WorkspaceTeam,
    });

    if (!sharing) {
      throw new ForbiddenException('Team does not have access to this folder');
    }

    if (!requestedFolderIsSharedRootFolder) {
      const navigationUp = folder.uuid === decoded.parentFolderId;
      const navigationDown = folder.parentId === decoded.folder.id;
      const navigationUpFromSharedFolder =
        navigationUp && decoded.sharedRootFolderId === decoded.folder.uuid;

      if (navigationUpFromSharedFolder) {
        throw new ForbiddenException(
          'Team does not have access to this folder',
        );
      }

      if (!navigationDown && !navigationUp) {
        throw new ForbiddenException(
          'Team does not have access to this folder',
        );
      }
    }

    const workspace = await this.workspaceRepository.findById(workspaceId);

    const workspaceUser = await this.userUsecases.getUser(
      workspace.workspaceUserId,
    );

    const [ownerRootFolder, items, sharingRole] = await Promise.all([
      this.folderUseCases.getFolderByUserId(
        workspaceUser.rootFolderId,
        workspaceUser.id,
      ),
      itemsType === WorkspaceItemType.Folder
        ? await getFolderContentByCreatedBy(itemFolder.createdBy, folder.uuid)
        : await getFilesFromFolder(itemFolder.createdBy, folder.uuid),
      this.sharingUseCases.findSharingRoleBy({ sharingId: sharing.id }),
    ]);

    return {
      items,
      credentials: {
        networkPass: workspaceUser.userId,
        networkUser: workspaceUser.bridgeUser,
      },
      token: generateTokenWithPlainSecret(
        {
          sharedRootFolderId: sharing.itemId,
          sharedWithType: sharing.sharedWithType,
          parentFolderId: parentFolder?.uuid || null,
          folder: {
            uuid: folder.uuid,
            id: folder.id,
          },
          workspace: {
            workspaceId: workspace.id,
            teamId,
          },
          owner: {
            uuid: itemFolder.createdBy,
          },
        },
        '1d',
        this.configService.get('secrets.jwt'),
      ),
      bucket: ownerRootFolder.bucket,
      parent: {
        uuid: parentFolder?.uuid || null,
        name: parentFolder?.plainName || null,
      },
      name: folder.plainName,
      role: sharingRole.role.name,
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

    const isWorkspaceFull = await this.isWorkspaceFull(workspace);

    if (isWorkspaceFull) {
      throw new BadRequestException(
        'This workspace is full and it does not accept more users',
      );
    }

    const workspaceUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const spaceLeft = await this.getAssignableSpaceInWorkspace(
      workspace,
      workspaceUser,
    );

    if (invite.spaceLimit > spaceLeft) {
      throw new BadRequestException(
        'The space assigned to this user is greater than the space available, invalid invitation',
      );
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
        driveUsage: 0,
        rootFolderId: rootFolder.uuid,
        backupsUsage: 0,
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

  async getUserInvites(user: User, limit: number, offset: number) {
    const invites = await this.workspaceRepository.findInvitesBy(
      {
        invitedUser: user.uuid,
      },
      limit,
      offset,
    );

    const invitesWithWorkspaceData = await Promise.all(
      invites.map(async (invite) => {
        const workspace = await this.workspaceRepository.findById(
          invite.workspaceId,
        );

        return {
          ...invite,
          workspace: workspace.toJSON(),
        };
      }),
    );

    return invitesWithWorkspaceData;
  }

  async getWorkspacePendingInvitations(
    workspaceId: WorkspaceAttributes['id'],
    limit: number,
    offset: number,
  ) {
    const invites = await this.workspaceRepository.findInvitesBy(
      {
        workspaceId,
      },
      limit,
      offset,
    );

    const invitedUsersUuuids = invites.map((invite) => invite.invitedUser);

    const [users, preCreatedUsers] = await Promise.all([
      this.userUsecases.findByUuids(invitedUsersUuuids),
      this.userUsecases.findPreCreatedUsersByUuids(invitedUsersUuuids),
    ]);

    const usersWithAvatars = await Promise.all(
      users.map(async (user) => {
        const avatar = user.avatar
          ? await this.userUsecases.getAvatarUrl(user.avatar)
          : null;
        return {
          ...user,
          avatar,
        };
      }),
    );

    const invitesWithUserData = invites.map((invite) => {
      const user = usersWithAvatars.find(
        (user) => invite.invitedUser === user.uuid,
      );

      const prePrecreatedUser = preCreatedUsers
        .find((user) => invite.invitedUser === user.uuid)
        ?.toJSON();

      const isGuessInvite = !user && !!prePrecreatedUser;

      return {
        ...invite,
        user: user ?? prePrecreatedUser,
        isGuessInvite,
      };
    });

    return invitesWithUserData;
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
  ): Promise<number> {
    const [
      spaceLimit,
      totalSpaceLimitAssigned,
      //totalSpaceAssignedInInvitations,
    ] = await Promise.all([
      this.networkService.getLimit(
        workpaceDefaultUser.bridgeUser,
        workpaceDefaultUser.userId,
      ),
      this.workspaceRepository.getTotalSpaceLimitInWorkspaceUsers(workspace.id),
      //this.workspaceRepository.getSpaceLimitInInvitations(workspace.id),
    ]);

    const spaceLeft = spaceLimit - totalSpaceLimitAssigned;

    return spaceLeft;
  }

  async getWorkspaceNetworkLimit(workspace: Workspace) {
    const workpaceDefaultUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    return this.networkService.getLimit(
      workpaceDefaultUser.bridgeUser,
      workpaceDefaultUser.userId,
    );
  }

  async getWorkspaceUsage(workspace: Workspace) {
    const [
      spaceLimit,
      totalSpaceLimitAssigned,
      totalSpaceAssignedInInvitations,
      spaceUsed,
    ] = await Promise.all([
      this.getWorkspaceNetworkLimit(workspace),
      this.workspaceRepository.getTotalSpaceLimitInWorkspaceUsers(workspace.id),
      this.workspaceRepository.getSpaceLimitInInvitations(workspace.id),
      this.workspaceRepository.getTotalDriveAndBackupUsageWorkspaceUsers(
        workspace.id,
      ),
    ]);

    const spaceAssigned =
      totalSpaceLimitAssigned + totalSpaceAssignedInInvitations;

    return { totalWorkspaceSpace: spaceLimit, spaceAssigned, spaceUsed };
  }

  async isWorkspaceFull(workspace: Workspace): Promise<boolean> {
    const [workspaceUsersCount /* workspaceInvitationsCount */] =
      await Promise.all([
        this.workspaceRepository.getWorkspaceUsersCount(workspace.id),
        //  this.workspaceRepository.getWorkspaceInvitationsCount(workspaceId),
      ]);

    return workspace.isWorkspaceFull(workspaceUsersCount);
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

    const workspacesFiltered = availablesWorkspaces.filter(
      ({ workspace, workspaceUser }) =>
        workspace.isWorkspaceReady() && !workspaceUser.deactivated,
    );

    const workspacesWithAvatar = await Promise.all(
      workspacesFiltered.map(async (item) => ({
        workspaceUser: item.workspaceUser.toJSON(),
        workspace: {
          ...item.workspace,
          avatar: item.workspace?.avatar
            ? await this.getAvatarUrl(item.workspace.avatar)
            : null,
        },
      })),
    );

    return {
      availableWorkspaces: workspacesWithAvatar,
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

  async findWorkspaceResourceOwner(workspace: Workspace) {
    return this.workspaceRepository.findWorkspaceResourcesOwner(workspace.id);
  }

  async isUserCreatorOfItem(
    requester: User,
    itemId: WorkspaceItemUser['itemId'],
    itemType: WorkspaceItemUser['itemType'],
  ) {
    const item = await this.workspaceRepository.getItemBy({
      itemId,
      itemType,
    });

    if (!item) {
      throw new NotFoundException('Item does not exist in workspace');
    }

    return item.isOwnedBy(requester);
  }

  async isUserCreatorOfAllItems(
    requester: User,
    items: Pick<WorkspaceItemUserAttributes, 'itemId' | 'itemType'>[],
  ) {
    const userItems =
      await this.workspaceRepository.getItemsByAttributesAndCreator(
        requester.uuid,
        items,
      );

    return userItems.length === items.length;
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
    search?: string,
  ) {
    const workspace = await this.workspaceRepository.findOne({
      id: workspaceId,
    });
    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const workspaceUsers = await this.workspaceRepository.findWorkspaceUsers(
      workspace.id,
      search,
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
          usedSpace: workspaceUser.getUsedSpace(),
          freeSpace: workspaceUser.getFreeSpace(),
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

  async getWorkspaceCredentials(workspaceId: WorkspaceAttributes['id']) {
    const workspace = await this.workspaceRepository.findOne({
      id: workspaceId,
    });

    const workspaceNetworkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    if (!workspaceNetworkUser) {
      throw new NotFoundException('Workspace user not found');
    }

    const rootFolder = await this.folderUseCases.getByUuid(
      workspace.rootFolderId,
    );

    const workspaceItemsToken = generateWithDefaultSecret(
      { workspaceId },
      '1d',
    );

    return {
      workspaceId: workspace.id,
      bucket: rootFolder.bucket,
      workspaceUserId: workspaceNetworkUser.uuid,
      email: workspaceNetworkUser.email,
      credentials: {
        networkPass: workspaceNetworkUser.userId,
        networkUser: workspaceNetworkUser.bridgeUser,
      },
      tokenHeader: workspaceItemsToken,
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

    if (workspace.ownerId === workspaceUser.memberId) {
      throw new BadRequestException(
        'You can not deactivate the owner of the workspace',
      );
    }

    await this.workspaceRepository.deactivateWorkspaceUser(
      workspaceUser.memberId,
      workspace.id,
    );
  }

  async activateWorkspaceUser(
    memberId: WorkspaceUserAttributes['memberId'],
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const workspaceUser = await this.workspaceRepository.findWorkspaceUser({
      memberId,
      workspaceId,
    });

    if (!workspaceUser) {
      throw new BadRequestException('This user is not part of workspace');
    }

    await this.workspaceRepository.updateWorkspaceUser(workspaceUser.id, {
      deactivated: false,
    });
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

  findUserAndWorkspace(
    userUuid: string,
    workspaceId: string,
  ): Promise<{
    workspace?: Workspace | null;
    workspaceUser?: WorkspaceUser | null;
  }> {
    return this.workspaceRepository.findWorkspaceAndUser(userUuid, workspaceId);
  }

  findWorkspaceItemByUser(
    createdBy: WorkspaceItemUser['createdBy'],
    itemId: WorkspaceItemUser['itemId'],
    itemType: WorkspaceItemUser['itemType'],
  ) {
    return this.workspaceRepository.getItemBy({ createdBy, itemId, itemType });
  }

  findById(workspaceId: string): Promise<Workspace | null> {
    return this.workspaceRepository.findById(workspaceId);
  }

  findByOwnerId(ownerId: string): Promise<Workspace[]> {
    return this.workspaceRepository.findByOwner(ownerId);
  }

  findOne(attributes: Partial<WorkspaceAttributes>): Promise<Workspace | null> {
    return this.workspaceRepository.findOne(attributes);
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

  async editWorkspaceDetails(
    workspaceId: WorkspaceAttributes['id'],
    user: User,
    editWorkspaceDetailsDto: EditWorkspaceDetailsDto,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!workspace.isUserOwner(user)) {
      throw new ForbiddenException('You are not the owner of this workspace');
    }

    if (
      editWorkspaceDetailsDto.phoneNumber ||
      editWorkspaceDetailsDto.address
    ) {
      try {
        await this.paymentService.updateBillingInfo(workspace.ownerId, {
          phoneNumber: editWorkspaceDetailsDto.phoneNumber,
          address: editWorkspaceDetailsDto.address,
        });
      } catch (error) {
        Logger.error(
          `[WORKSPACE/EDIT_DETAILS]: Error while updating billing information ${
            (error as Error).message
          }`,
        );
        throw new InternalServerErrorException(
          'Error while updating billing information',
        );
      }
    }
    await this.workspaceRepository.updateBy(
      { id: workspaceId },
      editWorkspaceDetailsDto,
    );
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

  findUserInWorkspace(
    userUuid: User['uuid'],
    workspaceId: Workspace['id'],
  ): Promise<WorkspaceUser | null> {
    return this.workspaceRepository.findWorkspaceUser({
      workspaceId,
      memberId: userUuid,
    });
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

    const workspaceUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const rootFolder = await this.folderUseCases.getByUuid(
      workspace.rootFolderId,
    );

    await this.folderUseCases.deleteByUser(workspaceUser, [rootFolder]);

    await this.workspaceRepository.deleteById(workspaceId);
  }

  async transferPersonalItemsToWorkspaceOwner(
    workspaceId: Workspace['id'],
    user: User,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.isUserOwner(user)) {
      throw new ForbiddenException('You are the owner of this workspace');
    }

    const memberWorkspaceUser =
      await this.workspaceRepository.findWorkspaceUser({
        workspaceId,
        memberId: user.uuid,
      });

    const memberRootFolder = await this.folderUseCases.getByUuid(
      memberWorkspaceUser.rootFolderId,
    );

    const foldersInPersonalRootFolder =
      await this.folderUseCases.getFoldersInWorkspace(
        user.uuid,
        workspace.id,
        {
          parentId: memberRootFolder.id,
          deleted: false,
          removed: false,
        },
        { limit: 1, offset: 0 },
      );

    const filesInPersonalRootFolder =
      await this.fileUseCases.getFilesInWorkspace(
        user.uuid,
        workspace.id,
        {
          folderId: memberRootFolder.id,
          status: FileStatus.EXISTS,
          deleted: false,
          removed: false,
        },
        { limit: 1, offset: 0 },
      );

    if (
      !foldersInPersonalRootFolder.length &&
      !filesInPersonalRootFolder.length
    )
      return;

    const workspaceNetworkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const ownerWorkspaceUser = await this.workspaceRepository.findWorkspaceUser(
      {
        workspaceId,
        memberId: workspace.ownerId,
      },
    );

    const movedFolder = await this.folderUseCases.moveFolder(
      workspaceNetworkUser,
      memberRootFolder.uuid,
      ownerWorkspaceUser.rootFolderId,
    );

    await this.workspaceRepository.updateItemBy(
      {
        createdBy: ownerWorkspaceUser.memberId,
      },
      {
        workspaceId,
        itemId: memberRootFolder.uuid,
      },
    );

    await this.folderUseCases.renameFolder(movedFolder, user.username);
  }

  async leaveWorkspace(
    workspaceId: Workspace['id'],
    user: User,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.isUserOwner(user)) {
      throw new BadRequestException('Owner can not leave workspace');
    }

    await this.transferPersonalItemsToWorkspaceOwner(workspaceId, user);

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
  async validateWorkspaceInvite(
    inviteId: WorkspaceInvite['id'],
  ): Promise<string> {
    const invite = await this.workspaceRepository.findInvite({ id: inviteId });

    if (!invite) {
      throw new BadRequestException('Invalid invite');
    }

    return invite.id;
  }

  getAvatarUrl(avatarKey: Workspace['avatar']): Promise<string> {
    return this.avatarService.getDownloadUrl(avatarKey);
  }

  async upsertAvatar(
    workspaceId: Workspace['id'],
    avatarKey: string,
  ): Promise<Error | { avatar: string }> {
    const workspace = await this.workspaceRepository.findOne({
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    if (!avatarKey) {
      throw new BadRequestException('Avatar key required');
    }

    if (workspace.avatar) {
      try {
        await this.avatarService.deleteAvatar(workspace.avatar);
      } catch (err) {
        Logger.error(
          `[WORKSPACE/SET_AVATAR]Deleting the avatar in workspaceId: ${
            workspace.id
          } has failed. Error: ${(err as Error).message}`,
        );
        throw new InternalServerErrorException();
      }
    }

    try {
      await this.workspaceRepository.updateById(workspace.id, {
        avatar: avatarKey,
      });
      const avatarUrl = await this.getAvatarUrl(avatarKey);
      return { avatar: avatarUrl };
    } catch (err) {
      Logger.error(
        `[WORKSPACE/SET_AVATAR]Adding the avatar in workspaceId: ${
          workspace.id
        } has failed. Error: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException();
    }
  }

  async deleteAvatar(workspaceId: Workspace['id']): Promise<Error | void> {
    const workspace = await this.workspaceRepository.findOne({
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    if (workspace.avatar) {
      try {
        await this.avatarService.deleteAvatar(workspace.avatar);
        await this.workspaceRepository.updateById(workspace.id, {
          avatar: null,
        });
      } catch (err) {
        Logger.error(
          `[WORKSPACE/DELETE_AVATAR]Deleting the avatar in workspaceId: ${
            workspace.id
          } has failed. Error: ${(err as Error).message}`,
        );
        throw new InternalServerErrorException();
      }
    }
  }
}
