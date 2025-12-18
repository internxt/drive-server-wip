import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
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
import { FolderUseCases, SortParamsFolder } from '../folder/folder.usecase';
import { WorkspaceUserMemberDto } from './dto/workspace-user-member.dto';
import {
  File,
  FileAttributes,
  FileStatus,
  SortableFileAttributes,
} from '../file/file.domain';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { FileUseCases, SortParamsFile } from '../file/file.usecase';
import {
  Folder,
  FolderAttributes,
  FolderStatus,
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
import { SharingInfo, SharingService } from '../sharing/sharing.service';
import { ChangeUserAssignedSpaceDto } from './dto/change-user-assigned-space.dto';
import { PaymentsService } from '../../externals/payments/payments.service';
import { SharingAccessTokenData } from '../sharing/guards/sharings-token.interface';
import { FuzzySearchUseCases } from '../fuzzy-search/fuzzy-search.usecase';
import { WorkspaceLog } from './domains/workspace-log.domain';
import { TrashItem } from './interceptors/workspaces-logs.interceptor';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';

@Injectable()
export class WorkspacesUsecases {
  constructor(
    private readonly teamRepository: SequelizeWorkspaceTeamRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingUseCases: SharingService,
    private readonly paymentService: PaymentsService,
    private readonly networkService: BridgeService,
    private readonly userRepository: SequelizeUserRepository,
    @Inject(forwardRef(() => UserUseCases))
    private readonly userUsecases: UserUseCases,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUseCases: FolderUseCases,
    private readonly avatarService: AvatarService,
    private readonly fuzzySearchUseCases: FuzzySearchUseCases,
    private readonly featureLimitsService: FeatureLimitService,
  ) {}

  async initiateWorkspace(
    ownerId: UserAttributes['uuid'],
    maxSpaceBytes: number,
    workspaceData: {
      address?: string;
      numberOfSeats: number;
      phoneNumber?: string;
      tierId?: string;
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

    if (workspaceData.tierId) {
      await this.userRepository.updateBy(
        { uuid: workspaceUser.uuid },
        { tierId: workspaceData.tierId },
      );
    }

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

  async getWorkspaceTeamsUserBelongsTo(
    memberId: WorkspaceTeamUser['memberId'],
    workspaceId: Workspace['id'],
  ) {
    const teams = await this.teamRepository.getTeamsUserBelongsTo(
      memberId,
      workspaceId,
    );

    return teams;
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

        const assignableSpace = await this.getWorkspaceNetworkLimit(workspace);

        const workspaceUser = WorkspaceUser.build({
          id: v4(),
          workspaceId: workspace.id,
          memberId: user.uuid,
          spaceLimit: assignableSpace,
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

    const spaceLeft = await this.getOwnerAvailableSpace(workspace);

    const spaceToAssign =
      createInviteDto.spaceLimit ??
      (await this.getWorkspaceFixedStoragePerUser(workspace));

    if (spaceToAssign > spaceLeft) {
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
      spaceLimit: spaceToAssign,
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

  async updateWorkspaceMemberCount(
    workspaceId: Workspace['id'],
    newMemberCount: number,
  ) {
    if (newMemberCount < 1) {
      throw new BadRequestException('Member count must be at least 1');
    }
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    await this.workspaceRepository.updateById(workspaceId, {
      numberOfSeats: newMemberCount,
    });
  }

  async calculateWorkspaceLimits(
    workspace: Workspace,
    newWorkspaceSpaceLimit: number,
    newNumberOfSeats?: number,
  ) {
    const currentWorkspaceSpaceLimit =
      await this.getWorkspaceNetworkLimit(workspace);

    const currentSpacePerUser =
      currentWorkspaceSpaceLimit / workspace.numberOfSeats;

    const newSpacePerUser =
      newWorkspaceSpaceLimit / (newNumberOfSeats ?? workspace.numberOfSeats);
    const spaceDifference = newSpacePerUser - currentSpacePerUser;

    const memberCount = await this.workspaceRepository.getWorkspaceUsersCount(
      workspace.id,
    );

    const unusedSpace =
      newWorkspaceSpaceLimit -
      currentWorkspaceSpaceLimit -
      spaceDifference * memberCount;

    return { unusedSpace, spaceDifference };
  }

  async validateStorageForPlanChange(
    workspace: Workspace,
    newWorkspaceSpaceLimit: number,
    newNumberOfSeats?: number,
  ) {
    const memberCount = await this.workspaceRepository.getWorkspaceUsersCount(
      workspace.id,
    );

    if (newNumberOfSeats && newNumberOfSeats < memberCount) {
      throw new BadRequestException(
        'Number of seats must be equal or superior to the number of users in the workspace',
      );
    }

    const ownerAvailableSpace = await this.getOwnerAvailableSpace(workspace);

    const { unusedSpace, spaceDifference } =
      await this.calculateWorkspaceLimits(
        workspace,
        newWorkspaceSpaceLimit,
        newNumberOfSeats,
      );

    const ownerAvailableSpaceAfterUpdate =
      ownerAvailableSpace + unusedSpace + spaceDifference;

    if (ownerAvailableSpaceAfterUpdate < 0) {
      throw new BadRequestException('Insufficient space to update workspace');
    }
  }

  async updateWorkspaceLimit(
    workspaceId: Workspace['id'],
    newWorkspaceSpaceLimit: number,
    newNumberOfSeats?: number,
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    const workspaceNetworkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const { unusedSpace, spaceDifference } =
      await this.calculateWorkspaceLimits(
        workspace,
        newWorkspaceSpaceLimit,
        newNumberOfSeats,
      );

    const workspaceUsers =
      await this.workspaceRepository.findWorkspaceUsers(workspaceId);

    for (const workspaceUser of workspaceUsers) {
      workspaceUser.spaceLimit += spaceDifference;

      await this.workspaceRepository.updateWorkspaceUser(
        workspaceUser.id,
        workspaceUser,
      );
    }

    await this.networkService.setStorage(
      workspaceNetworkUser.email,
      newWorkspaceSpaceLimit,
    );

    await this.adjustOwnerStorage(workspaceId, unusedSpace, 'ADD');
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

    const member = await this.workspaceRepository.findWorkspaceUser(
      {
        memberId,
        workspaceId,
      },
      true,
    );

    if (!member) {
      throw new BadRequestException('Member does not exist in this workspace');
    }

    const spaceLeft = await this.getAssignableSpaceInWorkspace(workspace);

    const newSpaceLimit = changeAssignedSpace.spaceLimit;
    const currentSpaceLimit = member.spaceLimit;
    const limitDifference = newSpaceLimit - currentSpaceLimit;
    const spaceLeftWithoutUser = spaceLeft + currentSpaceLimit;

    if (newSpaceLimit > spaceLeftWithoutUser) {
      throw new BadRequestException(
        `Space limit set for the user is superior to the space assignable in workspace. Assignable space: ${spaceLeftWithoutUser}`,
      );
    }

    if (member.getUsedSpace() >= newSpaceLimit) {
      throw new BadRequestException(
        'The space you are trying to assign to the user is less than the user already used space',
      );
    }

    const workspaceLimit = await this.getWorkspaceNetworkLimit(workspace);
    const maxSpacePerUser = workspaceLimit / workspace.numberOfSeats;

    if (newSpaceLimit > maxSpacePerUser) {
      throw new BadRequestException(
        `Space limit set for the user is superior to the space assignable per user in workspace. Max space per user: ${maxSpacePerUser}`,
      );
    }

    await this.adjustOwnerStorage(
      workspaceId,
      Math.abs(limitDifference),
      limitDifference > 0 ? 'DEDUCT' : 'ADD',
    );

    member.spaceLimit = changeAssignedSpace.spaceLimit;

    this.workspaceRepository.updateWorkspaceUser(member.id, member);

    return { ...member.toJSON(), usedSpace: member.getUsedSpace() };
  }

  async getWorkspaceUserTrashedItems(
    user: User,
    workspaceId: WorkspaceAttributes['id'],
    itemType: WorkspaceItemUserAttributes['itemType'],
    limit = 50,
    offset = 0,
    sort?: SortParamsFile | SortParamsFolder,
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
          sort,
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
          sort: sort as SortParamsFolder,
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

    const totalUsedDrive = await this.calculateFilesSizeSum(
      user.uuid,
      workspaceId,
      [FileStatus.EXISTS, FileStatus.TRASHED],
    );

    member.driveUsage = totalUsedDrive;
    member.lastUsageSyncAt = syncStartedAt;

    await this.workspaceRepository.updateWorkspaceUser(member.id, {
      driveUsage: member.driveUsage,
      lastUsageSyncAt: member.lastUsageSyncAt,
    });

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
  ): Promise<number> {
    const totalSize =
      await this.fileUseCases.getWorkspaceFilesSizeSumByStatuses(
        userId,
        workspaceId,
        statuses,
      );

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
      const allItems = [];
      const promises = [];
      for (let i = 0; i < itemCount; i += chunkSize) {
        const items = await getItems(i);
        allItems.push(...items);
        promises.push(deleteItems(items));
      }
      await Promise.all(promises);
      return allItems;
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

    const folders = await emptyTrashItems(
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

    const files = await emptyTrashItems(
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

    const items: TrashItem[] = [
      ...(Array.isArray(files) ? files : [])
        .filter((file) => file.uuid != null)
        .map((file) => ({
          type: WorkspaceItemType.File,
          uuid: file.uuid,
        })),
      ...(Array.isArray(folders) ? folders : [])
        .filter((folder) => folder.uuid != null)
        .map((folder) => ({
          type: WorkspaceItemType.Folder,
          uuid: folder.uuid,
        })),
    ];

    return { items };
  }

  async createFile(
    member: User,
    workspaceId: string,
    createFileDto: CreateWorkspaceFileDto,
    tier?,
  ) {
    const workspaceUser = await this.workspaceRepository.findWorkspaceUser({
      memberId: member.uuid,
      workspaceId,
    });

    if (!workspaceUser.hasEnoughSpaceForFile(Number(createFileDto.size))) {
      throw new BadRequestException('You have not enough space for this file');
    }

    const workspace = await this.workspaceRepository.findById(workspaceId);

    const isFileEmpty = BigInt(createFileDto.size) === BigInt(0);

    if (isFileEmpty) {
      await this.fileUseCases.checkWorkspaceEmptyFilesLimit(
        workspaceUser.memberId,
        workspace,
      );
    }

    const parentFolder = await this.workspaceRepository.getItemBy({
      workspaceId,
      itemId: createFileDto.folderUuid,
      itemType: WorkspaceItemType.Folder,
    });

    const folder = await this.folderUseCases.getByUuid(
      createFileDto.folderUuid,
    );

    if (!parentFolder || !folder) {
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
      {
        ...createFileDto,
        fileId: isFileEmpty ? null : createFileDto.fileId,
      },
      tier,
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

    const createdFolder = await this.folderUseCases.createFolder(networkUser, {
      plainName: createFolderDto.name,
      parentFolderUuid,
    });

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

  async getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
    userUuid: User['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    updatedAfter: Date,
    options?: {
      sort: SortableFileAttributes;
      order;
      limit: number;
      offset: number;
      status?: FileStatus;
    },
    bucket?: string,
  ) {
    const where: Partial<FileAttributes> = options?.status
      ? { status: options.status }
      : {};

    if (bucket) {
      where.bucket = bucket;
    }

    const files = await this.fileUseCases.getWorkspaceFilesUpdatedAfter(
      userUuid,
      workspaceId,
      updatedAfter,
      {
        ...where,
      },
      {
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        sort: options?.sort &&
          options?.order && [[options.sort, options.order]],
      },
    );

    return files;
  }

  async getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
    userUuid: User['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    updatedAfter: Date,
    options?: {
      sort: SortableFolderAttributes;
      order;
      limit: number;
      offset: number;
      status?: FolderStatus;
    },
  ) {
    const where: Partial<FolderAttributes> = options?.status
      ? Folder.getFilterByStatus(options.status)
      : {};

    const folders = await this.folderUseCases.getWorkspacesFoldersUpdatedAfter(
      userUuid,
      workspaceId,
      {
        ...where,
      },
      updatedAfter,
      {
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        sort: options?.sort &&
          options?.order && [[options.sort, options.order]],
      },
    );

    return folders;
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
      result: folders.map((f) => ({ ...f, status: FolderStatus.EXISTS })),
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

  async getItemSharedWith(
    user: User,
    workspaceId: string,
    itemId: Sharing['itemId'],
    itemType: WorkspaceItemType,
  ) {
    const [item, itemInWorkspace] = await Promise.all([
      itemType === WorkspaceItemType.File
        ? this.fileUseCases.getByUuid(itemId)
        : this.folderUseCases.getByUuid(itemId),
      this.workspaceRepository.getItemBy({
        itemId,
        itemType,
      }),
    ]);

    if (!itemInWorkspace || !item) {
      throw new NotFoundException('Item not found');
    }

    const sharingsWithRoles =
      await this.sharingUseCases.findSharingsWithRolesByItem(item);

    if (!sharingsWithRoles.length) {
      throw new BadRequestException(
        'This item is not being shared with anyone',
      );
    }

    const sharedWithIndividuals = sharingsWithRoles.filter(
      (s) => s.sharedWithType === SharedWithType.Individual,
    );

    const sharedWithTeams = sharingsWithRoles.filter(
      (s) => s.sharedWithType === SharedWithType.WorkspaceTeam,
    );

    const [teams, users] = await Promise.all([
      this.getWorkspaceTeamsUserBelongsTo(user.uuid, workspaceId),
      this.userUsecases.findByUuids(
        sharedWithIndividuals.map((s) => s.sharedWith),
      ),
    ]);

    const teamsIds = teams.map((team) => team.id);

    const isAnInvitedUser = sharedWithIndividuals.some(
      (s) => s.sharedWith === user.uuid,
    );
    const isTheOwner = itemInWorkspace.isOwnedBy(user);
    const belongsToSharedTeam = sharedWithTeams.some((s) =>
      teamsIds.includes(s.sharedWith),
    );

    if (!isTheOwner && !isAnInvitedUser && !belongsToSharedTeam) {
      throw new ForbiddenException();
    }

    const usersWithRoles = await Promise.all<SharingInfo>(
      sharedWithIndividuals.map(async (sharingWithRole) => {
        const user = users.find(
          (user) =>
            user.uuid === sharingWithRole.sharedWith &&
            sharingWithRole.sharedWithType == SharedWithType.Individual,
        );

        return {
          ...user,
          sharingId: sharingWithRole.id,
          avatar: user?.avatar
            ? await this.userUsecases.getAvatarUrl(user.avatar)
            : null,
          role: sharingWithRole.role,
        };
      }),
    );

    const { createdBy } = itemInWorkspace;

    const { name, lastname, email, avatar, uuid } =
      createdBy === user.uuid
        ? user
        : await this.userUsecases.getUser(createdBy);

    const ownerWithRole: SharingInfo = {
      name,
      lastname,
      email,
      sharingId: null,
      avatar: avatar ? await this.userUsecases.getAvatarUrl(avatar) : null,
      uuid,
      role: {
        id: 'NONE',
        name: 'OWNER',
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      },
    };

    usersWithRoles.push(ownerWithRole);

    const workspaceTeams =
      await this.teamRepository.getTeamsAndMembersCountByWorkspace(workspaceId);

    const teamsWithRoles = sharedWithTeams.map((sharingWithRole) => {
      const team = workspaceTeams.find(
        (team) =>
          team.team.id === sharingWithRole.sharedWith &&
          sharingWithRole.sharedWithType == SharedWithType.WorkspaceTeam,
      );

      return {
        ...team.team,
        membersCount: team.membersCount,
        sharingId: sharingWithRole.id,
        role: sharingWithRole.role,
      };
    });

    return { usersWithRoles, teamsWithRoles };
  }

  async getSharedFilesInWorkspace(
    user: User,
    workspaceId: Workspace['id'],
    options: { offset: number; limit: number; order?: [string, string][] },
  ) {
    const teams = await this.getWorkspaceTeamsUserBelongsTo(
      user.uuid,
      workspaceId,
    );

    const teamsIds = teams.map((team) => team.id);

    const response =
      await this.sharingUseCases.getSharedFilesInWorkspaceByTeams(
        user,
        workspaceId,
        teamsIds,
        options,
      );

    return {
      ...response,
      token: generateTokenWithPlainSecret(
        {
          workspace: {
            workspaceId,
          },
          isSharedItem: true,
          sharedWithUserUuid: user.uuid,
        },
        '1d',
        this.configService.get('secrets.jwt'),
      ),
    };
  }

  async getSharedFoldersInWorkspace(
    user: User,
    workspaceId: Workspace['id'],
    options: { offset: number; limit: number; order?: [string, string][] },
  ) {
    const teams = await this.getWorkspaceTeamsUserBelongsTo(
      user.uuid,
      workspaceId,
    );

    const teamsIds = teams.map((team) => team.id);

    const response =
      await this.sharingUseCases.getSharedFoldersInWorkspaceByTeams(
        user,
        workspaceId,
        teamsIds,
        options,
      );

    return {
      ...response,
      token: generateTokenWithPlainSecret(
        {
          workspace: {
            workspaceId,
          },
          isSharedItem: true,
          sharedWithUserUuid: user.uuid,
        },
        '1d',
        this.configService.get('secrets.jwt'),
      ),
    };
  }

  async getItemsInSharedFolder(
    workspaceId: Workspace['id'],
    user: User,
    folderUuid: Folder['uuid'],
    itemsType: WorkspaceItemType,
    token: string | null,
    options?: { page: number; perPage: number; order: string[][] },
  ) {
    const getFoldersFromFolder = async (
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

    const itemFolder = await this.workspaceRepository.getItemBy({
      itemId: folderUuid,
      itemType: WorkspaceItemType.Folder,
      workspaceId: workspaceId,
    });

    if (!itemFolder) {
      throw new NotFoundException('Item not found in workspace');
    }

    const currentFolder = await this.folderUseCases.getByUuid(folderUuid);

    if (currentFolder.isTrashed()) {
      throw new BadRequestException('This folder is trashed');
    }

    if (currentFolder.isRemoved()) {
      throw new BadRequestException('This folder is removed');
    }

    const parentFolder =
      currentFolder.parentUuid &&
      (await this.folderUseCases.getByUuid(currentFolder.parentUuid));

    if (itemFolder.isOwnedBy(user)) {
      const getItemsFromFolder =
        itemsType === WorkspaceItemType.Folder
          ? getFoldersFromFolder
          : getFilesFromFolder;

      const itemsInFolder = await getItemsFromFolder(
        itemFolder.createdBy,
        currentFolder.uuid,
      );

      return {
        items: itemsInFolder,
        name: currentFolder.plainName,
        bucket: '',
        encryptionKey: null,
        token: '',
        parent: {
          uuid: parentFolder?.uuid ?? null,
          name: parentFolder?.plainName ?? null,
        },
        role: 'OWNER',
      };
    }

    const isSharedRootFolderRequest = !token;

    const decodedAccessToken = isSharedRootFolderRequest
      ? null
      : (verifyWithDefaultSecret(token) as SharingAccessTokenData);

    if (typeof decodedAccessToken === 'string') {
      throw new ForbiddenException('Invalid token');
    }

    const teamsUserBelongsTo = await this.teamRepository.getTeamsUserBelongsTo(
      user.uuid,
      workspaceId,
    );

    const teamIds = teamsUserBelongsTo.map((team) => team.id);

    const itemSharedWithTeam =
      await this.sharingUseCases.findSharingsBySharedWithAndAttributes(
        teamIds,
        {
          sharedWithType: SharedWithType.WorkspaceTeam,
          itemId: isSharedRootFolderRequest
            ? folderUuid
            : decodedAccessToken.sharedRootFolderId,
        },
        { limit: 1, offset: 0, givePriorityToRole: 'EDITOR' },
      );

    const sharing = itemSharedWithTeam[0];

    if (!sharing) {
      throw new ForbiddenException('Team does not have access to this folder');
    }

    if (!isSharedRootFolderRequest) {
      const {
        folder: sourceFolder,
        parentFolderId: sourceParentFolderId,
        sharedRootFolderId,
      } = decodedAccessToken;

      const navigationUp = currentFolder.uuid === sourceParentFolderId;
      const navigationDown = currentFolder.parentId === sourceFolder.id;
      const navigationUpFromSharedFolder =
        navigationUp && sharedRootFolderId === sourceFolder.uuid;

      if (navigationUpFromSharedFolder || (!navigationDown && !navigationUp)) {
        throw new ForbiddenException(
          'Team does not have access to this folder',
        );
      }
    }

    const { workspaceUser, workspace } =
      await this.workspaceRepository.findWorkspaceAndDefaultUser(workspaceId);

    const [ownerRootFolder, folderItems, sharingAccessRole] = await Promise.all(
      [
        this.folderUseCases.getFolderByUserId(
          workspaceUser.rootFolderId,
          workspaceUser.id,
        ),
        itemsType === WorkspaceItemType.Folder
          ? await getFoldersFromFolder(itemFolder.createdBy, currentFolder.uuid)
          : await getFilesFromFolder(itemFolder.createdBy, currentFolder.uuid),
        this.sharingUseCases.findSharingRoleBy({ sharingId: sharing.id }),
      ],
    );

    return {
      items: folderItems,
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
            uuid: currentFolder.uuid,
            id: currentFolder.id,
          },
          workspace: {
            workspaceId: workspace.id,
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
      name: currentFolder.plainName,
      role: sharingAccessRole.role.name,
    };
  }

  async adjustOwnerStorage(
    workspaceId: Workspace['id'],
    size: number,
    behavior: 'DEDUCT' | 'ADD',
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const owner = await this.workspaceRepository.findWorkspaceUser({
      workspaceId,
      memberId: workspace.ownerId,
    });

    const workspaceNetworkLimit =
      await this.getWorkspaceNetworkLimit(workspace);

    const ownerUsage = await this.calculateFilesSizeSum(
      workspace.ownerId,
      workspace.id,
      [FileStatus.EXISTS, FileStatus.TRASHED],
    );

    const availableSpace = workspaceNetworkLimit - ownerUsage;

    switch (behavior) {
      case 'DEDUCT':
        if (availableSpace < size) {
          throw new BadRequestException(
            'Not enough space available to perform this operation',
          );
        }
        break;
      case 'ADD':
        if (owner.spaceLimit + size > workspaceNetworkLimit) {
          throw new BadRequestException(
            'Not enough space available to perform this operation',
          );
        }
        break;
    }

    const newSpaceLimit =
      behavior === 'DEDUCT' ? owner.spaceLimit - size : owner.spaceLimit + size;

    await this.workspaceRepository.updateWorkspaceUserBy(
      { workspaceId, memberId: workspace.ownerId },
      { spaceLimit: newSpaceLimit },
    );
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

    const spaceLeft = await this.getOwnerAvailableSpace(workspace);

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

      await this.adjustOwnerStorage(workspace.id, invite.spaceLimit, 'DEDUCT');

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
      { plainName: v4(), parentFolderUuid: workspaceRootFolderId },
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

  async getOwnerAvailableSpace(workspace: Workspace) {
    const ownerUsedSpace = await this.calculateFilesSizeSum(
      workspace.ownerId,
      workspace.id,
      [FileStatus.EXISTS, FileStatus.TRASHED],
    );

    const owner = await this.workspaceRepository.findWorkspaceUser({
      workspaceId: workspace.id,
      memberId: workspace.ownerId,
    });

    const availableSpace = owner.spaceLimit - ownerUsedSpace;

    return availableSpace;
  }

  async getAssignableSpaceInWorkspace(workspace: Workspace): Promise<number> {
    const [ownerAvailableSpace, totalInInvites] = await Promise.all([
      this.getOwnerAvailableSpace(workspace),
      this.workspaceRepository.getSpaceLimitInInvitations(workspace.id),
    ]);

    return ownerAvailableSpace - totalInInvites;
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
      //totalSpaceAssignedInInvitations,
      spaceUsed,
    ] = await Promise.all([
      this.getWorkspaceNetworkLimit(workspace),
      this.workspaceRepository.getTotalSpaceLimitInWorkspaceUsers(workspace.id),
      /*this.workspaceRepository.getSpaceLimitInInvitations(workspace.id),*/
      this.workspaceRepository.getTotalDriveAndBackupUsageWorkspaceUsers(
        workspace.id,
      ),
    ]);

    const spaceAssigned = totalSpaceLimitAssigned;

    return { totalWorkspaceSpace: spaceLimit, spaceAssigned, spaceUsed };
  }

  async isWorkspaceFull(
    workspace: Workspace,
    //skipOneInvite = false,
  ): Promise<boolean> {
    const [workspaceUsersCount /*workspaceInvitationsCount*/] =
      await Promise.all([
        this.workspaceRepository.getWorkspaceUsersCount(workspace.id),
        //this.workspaceRepository.getWorkspaceInvitationsCount(workspace.id),
      ]);

    return workspace.isWorkspaceFull(
      workspaceUsersCount,
      /*skipOneInvite ? workspaceInvitationsCount - 1 : workspaceInvitationsCount,*/
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

  async getWorkspaceItemBySharingId(sharingId: Sharing['id']) {
    const sharing = await this.sharingUseCases.findSharingBy({ id: sharingId });

    if (!sharing) {
      throw new BadRequestException('Sharing does not exist');
    }

    const item = await this.workspaceRepository.getItemBy({
      itemId: sharing.itemId,
    });

    return item;
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
      id: workspaceId,
    });

    if (!workspace) {
      throw new BadRequestException('Not valid workspace');
    }

    const [teamsWithMemberCount, teamsUserBelongsTo] = await Promise.all([
      this.teamRepository.getTeamsAndMembersCountByWorkspace(workspace.id),
      this.teamRepository.getTeamsUserBelongsTo(user.uuid, workspace.id),
    ]);

    const isUserOwner = workspace.isUserOwner(user);
    const userTeamsSet = new Set(teamsUserBelongsTo.map((team) => team.id));

    const filteredTeams = teamsWithMemberCount.filter((teamAndMembers) => {
      const isDefaultTeam = workspace.defaultTeamId === teamAndMembers.team.id;
      const isUserTeamMember = userTeamsSet.has(teamAndMembers.team.id);

      return !isDefaultTeam && (isUserOwner || isUserTeamMember);
    });

    return filteredTeams;
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
        (workspaceUserMember) => !workspaceUserMember.deactivated,
      ),
      disabledUsers: workspaceUserMembers.filter(
        (workspaceUserMember) => workspaceUserMember.deactivated,
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

  getTeamsUserBelongsTo(
    userUuid: string,
    workspaceId: string,
  ): Promise<WorkspaceTeam[]> {
    return this.teamRepository.getTeamsUserBelongsTo(userUuid, workspaceId);
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
    includeUser = false,
  ): Promise<WorkspaceUser | null> {
    return this.workspaceRepository.findWorkspaceUser(
      {
        workspaceId,
        memberId: userUuid,
      },
      includeUser,
    );
  }

  async deleteWorkspaceContent(
    workspaceId: Workspace['id'],
    user: User,
  ): Promise<WorkspaceUser[]> {
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

    const workspaceMembers =
      await this.workspaceRepository.findWorkspaceUsers(workspaceId);

    await this.folderUseCases.deleteByUser(workspaceUser, [rootFolder]);

    await this.workspaceRepository.deleteById(workspaceId);

    return workspaceMembers;
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

    const memberUsage = await this.calculateFilesSizeSum(
      user.uuid,
      workspace.id,
      [FileStatus.EXISTS, FileStatus.TRASHED],
    );

    const ownerUsage = await this.calculateFilesSizeSum(
      workspace.ownerId,
      workspace.id,
      [FileStatus.EXISTS, FileStatus.TRASHED],
    );

    const combinedUsage = Number(memberUsage) + Number(ownerUsage);

    const ownerWorkspaceUser = await this.workspaceRepository.findWorkspaceUser(
      {
        workspaceId,
        memberId: workspace.ownerId,
      },
    );

    if (Number(ownerWorkspaceUser.spaceLimit) < combinedUsage) {
      throw new BadRequestException(
        'Owner does not have enough space to receive the files',
      );
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

    const movedFolder = await this.folderUseCases.moveFolder(
      workspaceNetworkUser,
      memberRootFolder.uuid,
      { destinationFolder: ownerWorkspaceUser.rootFolderId },
    );

    await this.workspaceRepository.updateItemBy(
      {
        createdBy: memberWorkspaceUser.memberId,
        workspaceId,
      },
      {
        createdBy: workspace.ownerId,
      },
    );

    const shortMemberIdentifier = Buffer.from(memberWorkspaceUser.id)
      .toString('base64')
      .substring(0, 6);

    await this.folderUseCases.renameFolder(
      movedFolder,
      `${user.username} - ${shortMemberIdentifier}`,
    );
  }

  async removeWorkspaceMember(
    workspaceId: Workspace['id'],
    memberId: User['uuid'],
  ): Promise<void> {
    const workspaceUserToRemove =
      await this.workspaceRepository.findWorkspaceUser(
        {
          workspaceId,
          memberId,
        },
        true,
      );

    if (!workspaceUserToRemove) {
      throw new NotFoundException('User not found in workspace');
    }

    await this.leaveWorkspace(workspaceId, workspaceUserToRemove.member);
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

    const workspaceUserToRemove =
      await this.workspaceRepository.findWorkspaceUser({
        workspaceId,
        memberId: user.uuid,
      });

    await this.adjustOwnerStorage(
      workspaceId,
      workspaceUserToRemove.spaceLimit,
      'ADD',
    );

    const teamsUserBelongsTo = await this.teamRepository.getTeamsUserBelongsTo(
      user.uuid,
      workspaceId,
    );

    for (const team of teamsUserBelongsTo) {
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

  async searchWorkspaceContent(
    user: User,
    workspaceId: Workspace['id'],
    search: string,
    offset: number,
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const searchResults = await this.fuzzySearchUseCases.workspaceFuzzySearch(
      user.uuid,
      workspace,
      search,
      offset,
    );

    return searchResults;
  }

  async accessLogs(
    workspaceId: Workspace['id'],
    pagination: {
      limit?: number;
      offset?: number;
    },
    member?: string,
    logType?: WorkspaceLog['type'][],
    lastDays?: number,
    summary: boolean = true,
    order?: [string, string][],
  ) {
    let membersUuids: string[];
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (member) {
      const workspaceUsers = await this.workspaceRepository.findWorkspaceUsers(
        workspace.id,
        member,
      );
      membersUuids = workspaceUsers.map((user: WorkspaceUser) => user.memberId);
    }

    return this.workspaceRepository.accessLogs(
      workspace.id,
      summary,
      membersUuids,
      logType,
      pagination,
      lastDays,
      order,
    );
  }

  async getWorkspaceItemAncestors(
    workspaceId: Workspace['id'],
    itemType: WorkspaceItemType,
    itemUuid: Sharing['itemId'],
  ) {
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const folderUuid =
      itemType === WorkspaceItemType.File
        ? (await this.fileUseCases.getByUuid(itemUuid)).folderUuid
        : itemUuid;

    if (!folderUuid) {
      throw new NotFoundException('Folder uuid required');
    }

    const owner = await this.findWorkspaceResourceOwner(workspace);

    const folders = await this.folderUseCases.getFolderAncestorsInWorkspace(
      owner,
      folderUuid,
    );

    return folders.map((f) => ({
      uuid: f.uuid,
      plainName: f.plainName,
    }));
  }

  async resetWorkspace(workspace: Workspace): Promise<void> {
    const workspaceNetworkUser = await this.userRepository.findByUuid(
      workspace.workspaceUserId,
    );

    const allMembers = await this.workspaceRepository.findWorkspaceUsers(
      workspace.id,
    );
    const ownerMember = allMembers.find(
      (member) => member.memberId === workspace.ownerId,
    );
    const nonOwnerMembers = allMembers.filter(
      (member) => member.id !== ownerMember.id,
    );

    const workspaceOwnerUser = await this.userRepository.findByUuid(
      workspace.ownerId,
    );

    await this.folderUseCases.deleteByUuids(
      workspaceNetworkUser,
      nonOwnerMembers.map((members) => members.rootFolderId),
    );

    await this.workspaceRepository.deleteUsersFromWorkspace(
      workspace.id,
      allMembers.map((member) => member.memberId),
    );

    const workspaceTotalSpace = await this.getWorkspaceNetworkLimit(workspace);

    await Promise.all([
      this.workspaceRepository.deleteAllInvitationsByWorkspace(workspace.id),
      this.deleteWorkspaceContent(workspace.id, workspaceOwnerUser),
      this.initiateWorkspace(workspace.ownerId, workspaceTotalSpace, {
        numberOfSeats: workspace.numberOfSeats,
        phoneNumber: workspace.phoneNumber,
        address: workspace.address,
        tierId: workspaceNetworkUser.tierId,
      }),
    ]);
  }

  async emptyAllUserOwnedWorkspaces(user: User): Promise<void> {
    const workspaces = await this.workspaceRepository.findByOwner(user.uuid);

    await Promise.all(
      workspaces.map((workspace) => this.resetWorkspace(workspace)),
    );
  }

  async removeUserFromNonOwnedWorkspaces(user: User): Promise<void> {
    const ownedWorkspaces = await this.workspaceRepository.findByOwner(
      user.uuid,
    );

    const allWorkspaceMemberships =
      await this.workspaceRepository.findWorkspaceUsersByUserUuid(user.uuid);

    const nonOwnedWorkspaceMemberships = allWorkspaceMemberships.filter(
      (membership) =>
        !ownedWorkspaces.some(
          (workspace) => workspace.id === membership.workspaceId,
        ),
    );

    await this.workspaceRepository.deleteAllInvitationByUser(user.uuid);

    await Promise.all(
      nonOwnedWorkspaceMemberships.map((membership) =>
        this.leaveWorkspace(membership.workspaceId, user),
      ),
    );
  }
}
