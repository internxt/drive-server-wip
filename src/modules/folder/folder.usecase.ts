import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
  RequestTimeoutException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { SequelizeUserRepository } from '../user/user.repository';
import {
  Folder,
  FolderOptions,
  SortableFolderAttributes,
} from './folder.domain';
import { FolderAttributes } from './folder.attributes';
import { SequelizeFolderRepository } from './folder.repository';
import { SharingService } from '../sharing/sharing.service';
import { SharingItemType } from '../sharing/sharing.domain';
import { WorkspaceItemUserAttributes } from '../workspaces/attributes/workspace-items-users.attributes';
import { v4 } from 'uuid';
import { UpdateFolderMetaDto } from './dto/update-folder-meta.dto';
import { FolderStatsDto } from './dto/responses/folder-stats.dto';
import { WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';
import { FileUseCases } from '../file/file.usecase';
import { File, FileStatus } from '../file/file.domain';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderModel } from './folder.model';
import { MoveFolderDto } from './dto/move-folder.dto';
import { TrashItemType } from '../trash/trash.attributes';
import { TrashUseCases } from '../trash/trash.usecase';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';

const invalidName = /[\\/]|^\s*$/;

export type SortParamsFolder = Array<
  [SortableFolderAttributes, 'ASC' | 'DESC']
>;

@Injectable()
export class FolderUseCases {
  constructor(
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly userRepository: SequelizeUserRepository,
    @Inject(forwardRef(() => SharingService))
    private readonly sharingUsecases: SharingService,
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUsecases: FileUseCases,
    private readonly cryptoService: CryptoService,
    @Inject(forwardRef(() => TrashUseCases))
    private readonly trashUsecases: TrashUseCases,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  getFoldersByIds(user: User, folderIds: FolderAttributes['id'][]) {
    return this.folderRepository.findByIds(user, folderIds);
  }

  async getByUuid(uuid: Folder['uuid']): Promise<Folder> {
    const folder = await this.folderRepository.findByUuid(uuid, false);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    folder.plainName =
      folder.plainName ??
      this.cryptoService.decryptName(folder.name, folder.parentId);

    return folder;
  }

  async getByUuids(uuids: Folder['uuid'][], user?: User): Promise<Folder[]> {
    const folders = await this.folderRepository.findByUuids(uuids, user?.id);

    return folders.map((folder) =>
      !folder.plainName ? this.decryptFolderName(folder) : folder,
    );
  }

  async getFolderByUuidAndUser(
    uuid: FolderAttributes['uuid'],
    user: User,
  ): Promise<Folder> {
    const folder = await this.folderRepository.findByUuidAndUser(uuid, user.id);

    if (!folder) {
      throw new NotFoundException();
    }

    return folder;
  }

  async removeUserOrphanFolders(user: User): Promise<number> {
    const removedFoldersCount = await this.folderRepository.updateBy(
      { removed: true, deleted: true },
      { userId: user.id, parentId: null },
    );

    return removedFoldersCount;
  }

  async getFolderByUuid(
    folderUuid: FolderAttributes['uuid'],
    user: User,
  ): Promise<Folder> {
    const folder = await this.folderRepository.findByUuid(folderUuid, false);

    if (!folder) {
      throw new NotFoundException();
    }

    if (folder.userId !== user.id) {
      throw new ForbiddenException();
    }

    return folder;
  }

  async getFolderTree(
    user: User,
    rootFolderUuid: FolderAttributes['uuid'],
    deleted = false,
  ) {
    const rootElements = [];
    const pendingFolders = [
      {
        folderUuid: rootFolderUuid,
        elements: rootElements,
      },
    ];

    while (pendingFolders.length) {
      const { folderUuid, elements } = pendingFolders.shift();

      const folder: Folder & { files?: File[]; children?: Folder[] } =
        await this.folderRepository.findByUuid(folderUuid);

      if (!folder) {
        throw new NotFoundException('Folder does not exist!');
      }

      if (!folder.isOwnedBy(user)) {
        throw new ForbiddenException('Folder does not belong to you!');
      }

      folder.files = await this.fileUsecases.getFilesByFolderUuid(
        folder.uuid,
        deleted ? FileStatus.TRASHED : FileStatus.EXISTS,
      );

      folder.children = [];

      const folders = await this.folderRepository.findAllByParentUuid(
        folderUuid,
        deleted,
      );

      folders.forEach((f) => {
        pendingFolders.push({
          folderUuid: f.uuid,
          elements: folder.children,
        });
      });

      elements.push(folder);
    }

    return rootElements[0];
  }

  async getFolderByUserId(
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ) {
    const folder = await this.folderRepository.findOne({
      userId,
      id: folderId,
    });

    return folder;
  }

  async getUserRootFolder(user: User): Promise<Folder | null> {
    const folder = await this.folderRepository.findOne({
      id: user.rootFolderId,
      userId: user.id,
    });

    return folder;
  }

  async getFolder(
    folderId: FolderAttributes['id'],
    { deleted }: FolderOptions = { deleted: false },
  ): Promise<Folder> {
    const folder = await this.folderRepository.findById(folderId, deleted);

    return folder ? this.decryptFolderName(folder) : null;
  }

  async isFolderInsideFolder(
    parentId: FolderAttributes['id'],
    folderId: FolderAttributes['id'],
    userId: UserAttributes['id'],
  ): Promise<boolean> {
    const folder = await this.folderRepository.findOne({
      id: folderId,
      userId,
      deleted: false,
    });

    const folderExists = !!folder;

    if (!folderExists) {
      return false;
    }

    const folderInsideTree = await this.folderRepository.findInTree(
      parentId,
      folderId,
      userId,
      false,
    );
    const folderIsInsideTree = !!folderInsideTree;

    return folderIsInsideTree;
  }

  async getChildrenFoldersToUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    { deleted }: FolderOptions = { deleted: false },
  ) {
    const folders = await this.folderRepository.findAllByParentIdAndUserId(
      folderId,
      userId,
      deleted,
    );

    return folders;
  }

  async getFoldersByUserId(
    userId: FolderAttributes['userId'],
    where: Partial<FolderAttributes>,
  ): Promise<Folder[]> {
    return this.folderRepository.findAll({ userId, ...where });
  }

  async createRootFolder(
    creator: User,
    name: FolderAttributes['name'],
    bucketId: string,
  ): Promise<Folder> {
    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    if (name === '' || invalidName.test(name)) {
      throw new Error('Invalid folder name');
    }

    const encryptedFolderName = this.cryptoService.encryptName(name, null);

    const folder = await this.folderRepository.create(
      user.id,
      encryptedFolderName,
      bucketId,
      null,
      '03-aes',
    );

    return folder;
  }

  async createFolders(
    creator: User,
    folders: {
      name: FolderAttributes['name'];
      parentFolderId: FolderAttributes['parentId'];
      parentUuid: FolderAttributes['parentUuid'];
    }[],
  ): Promise<Folder[]> {
    for (const { parentFolderId } of folders) {
      if (parentFolderId >= 2147483648) {
        throw new Error('Invalid parent folder');
      }
    }

    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    return this.folderRepository.bulkCreate(
      folders.map((folder) => {
        return {
          userId: user.id,
          plainName: folder.name,
          name: this.cryptoService.encryptName(
            folder.name,
            folder.parentFolderId,
          ),
          encryptVersion: '03-aes',
          bucket: null,
          parentId: folder.parentFolderId,
          parentUuid: folder.parentUuid,
        };
      }),
    );
  }

  async createFolderDevice(user: User, folderData: Partial<FolderAttributes>) {
    if (!folderData.plainName || !folderData.bucket) {
      throw new BadRequestException('Folder name and bucket are required');
    }
    return this.folderRepository.createFolder(user.id, folderData);
  }

  async updateFolderMetaData(
    user: User,
    folderUuid: Folder['uuid'],
    newFolderMetadata: UpdateFolderMetaDto,
  ) {
    const folder = await this.folderRepository.findOne({
      uuid: folderUuid,
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.isRemoved()) {
      throw new UnprocessableEntityException(
        'Cannot update this folder metadata',
      );
    }

    if (!folder.isOwnedBy(user)) {
      throw new ForbiddenException('This folder is not yours');
    }

    const cryptoFileName = this.cryptoService.encryptName(
      newFolderMetadata.plainName,
      folder.parentId,
    );

    const folderWithSameNameExists = await this.folderRepository.findOne({
      name: cryptoFileName,
      parentId: folder.parentId,
      deleted: false,
      removed: false,
    });

    if (folderWithSameNameExists) {
      throw new ConflictException(
        'A folder with this name already exists in this location',
      );
    }

    const updatedFolder = await this.folderRepository.updateByFolderId(
      folder.id,
      {
        plainName: newFolderMetadata.plainName,
        name: cryptoFileName,
        modificationTime: new Date(),
      },
    );

    return updatedFolder;
  }

  async createFolder(
    creator: User,
    newFolderDto: CreateFolderDto,
  ): Promise<Folder> {
    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    const parentFolder = await this.folderRepository.findOne({
      uuid: newFolderDto.parentFolderUuid,
      userId: user.id,
    });

    if (!parentFolder) {
      throw new NotFoundException('Parent folder does not exist');
    }

    if (
      newFolderDto.plainName === '' ||
      invalidName.test(newFolderDto.plainName)
    ) {
      throw new BadRequestException('Invalid folder name');
    }

    const nameAlreadyInUse = await this.folderRepository.findOne({
      parentId: parentFolder.id,
      plainName: newFolderDto.plainName,
      deleted: false,
    });

    if (nameAlreadyInUse) {
      throw new ConflictException(
        'Folder with the same name already exists in this location',
      );
    }

    const encryptedFolderName = this.cryptoService.encryptName(
      newFolderDto.plainName,
      parentFolder.id,
    );

    const folder = await this.folderRepository.createWithAttributes({
      uuid: v4(),
      userId: user.id,
      name: encryptedFolderName,
      plainName: newFolderDto.plainName,
      parentId: parentFolder.id,
      parentUuid: parentFolder.uuid,
      encryptVersion: '03-aes',
      bucket: null,
      deleted: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      removedAt: null,
      deletedAt: null,
      modificationTime: newFolderDto.modificationTime || new Date(),
      creationTime: newFolderDto.creationTime || new Date(),
    });

    return folder;
  }

  async moveFolderToTrash(folderId: FolderAttributes['id']): Promise<Folder> {
    return this.folderRepository.updateByFolderId(folderId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }

  async deleteByUuids(user: User, uuids: Folder['uuid'][]): Promise<void> {
    await this.folderRepository.deleteByUserAndUuids(user, uuids);
  }

  async moveFoldersToTrash(
    user: User,
    folderIds: FolderAttributes['id'][],
    folderUuids: FolderAttributes['uuid'][] = [],
    tierLabel?: string,
  ): Promise<void> {
    const [foldersById, driveRootFolder, foldersByUuid] = await Promise.all([
      this.getFoldersByIds(user, folderIds),
      this.getFolder(user.rootFolderId),
      folderUuids.length > 0
        ? this.folderRepository.findUserFoldersByUuid(user, folderUuids)
        : Promise.resolve<Folder[]>([]),
    ]);

    const folders = foldersById.concat(foldersByUuid);

    const backups = folders.filter((f) => f.isBackup(driveRootFolder));
    const driveFolders = folders.filter(
      (f) => !f.isBackup(driveRootFolder) && f.id !== user.rootFolderId,
    );

    await Promise.all([
      driveFolders.length > 0
        ? this.folderRepository.updateManyByFolderId(
            driveFolders.map((f) => f.id),
            {
              deleted: true,
              deletedAt: new Date(),
            },
          )
        : Promise.resolve(),
      backups.length > 0
        ? this.folderRepository.updateManyByFolderId(
            backups.map((f) => f.id),
            {
              deleted: true,
              deletedAt: new Date(),
              removed: true,
              removedAt: new Date(),
            },
          )
        : Promise.resolve(),
      this.sharingUsecases.bulkRemoveSharings(
        user,
        folders.map((folder) => folder.uuid),
        SharingItemType.Folder,
      ),
    ]);

    if (driveFolders.length > 0) {
      this.trashUsecases
        .addItemsToTrash(
          driveFolders.map((f) => f.uuid),
          TrashItemType.Folder,
          tierLabel,
          user.id,
        )
        .catch((err) =>
          Logger.error(`[TRASH] Error adding folders to trash: ${err.message}`),
        );
    }
  }

  async getFoldersByParentId(
    parentId: FolderAttributes['id'],
    userId: UserAttributes['id'],
    options = { deleted: false, limit: 20, offset: 0 },
  ): Promise<Folder[]> {
    return this.getFolders(
      userId,
      { parentId, deleted: options.deleted },
      options,
    );
  }

  getAllFoldersUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: {
      limit: number;
      offset: number;
      sort?: Array<[keyof FolderAttributes, 'ASC' | 'DESC']>;
    },
  ): Promise<Folder[]> {
    return this.getFoldersUpdatedAfter(userId, {}, updatedAfter, options);
  }

  getNotTrashedFoldersUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: {
      limit: number;
      offset: number;
      sort?: Array<[keyof FolderAttributes, 'ASC' | 'DESC']>;
    },
  ): Promise<Folder[]> {
    return this.getFoldersUpdatedAfter(
      userId,
      {
        deleted: false,
        removed: false,
      },
      updatedAfter,
      options,
    );
  }

  getRemovedFoldersUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: {
      limit: number;
      offset: number;
      sort?: Array<[keyof FolderAttributes, 'ASC' | 'DESC']>;
    },
  ): Promise<Folder[]> {
    return this.getFoldersUpdatedAfter(
      userId,
      { removed: true },
      updatedAfter,
      options,
    );
  }

  getTrashedFoldersUpdatedAfter(
    userId: UserAttributes['id'],
    updatedAfter: Date,
    options: {
      limit: number;
      offset: number;
      sort?: Array<[keyof FolderAttributes, 'ASC' | 'DESC']>;
    },
  ): Promise<Folder[]> {
    return this.getFoldersUpdatedAfter(
      userId,
      { deleted: true, removed: false },
      updatedAfter,
      options,
    );
  }

  async searchFoldersInFolder(
    user: User,
    folderUuid: Folder['uuid'],
    { plainNames }: { plainNames: Folder['plainName'][] },
  ): Promise<Folder[]> {
    const parentFolder = await this.folderRepository.findOne({
      userId: user.id,
      uuid: folderUuid,
      removed: false,
      deleted: false,
    });

    if (!parentFolder) {
      throw new BadRequestException('Parent folder not valid');
    }

    return this.folderRepository.findByParent(parentFolder.id, {
      plainName: plainNames,
      deleted: false,
      removed: false,
    });
  }

  getFoldersUpdatedAfter(
    userId: UserAttributes['id'],
    where: Partial<FolderAttributes>,
    updatedAfter: Date,
    options: {
      limit: number;
      offset: number;
      sort?: Array<[keyof FolderAttributes, 'ASC' | 'DESC']>;
    },
  ): Promise<Array<Folder>> {
    const additionalOrders: Array<[keyof FolderAttributes, 'ASC' | 'DESC']> =
      options.sort ?? [['updatedAt', 'ASC']];
    return this.folderRepository.findAllCursorWhereUpdatedAfter(
      { ...where, userId },
      updatedAfter,
      options.limit,
      options.offset,
      additionalOrders,
    );
  }

  getWorkspacesFoldersUpdatedAfter(
    createdBy: User['uuid'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<Folder>,
    updatedAfter: Date,
    options: { limit: number; offset: number; sort?: SortParamsFolder },
  ): Promise<Array<Folder>> {
    const additionalOrders: Array<[keyof FolderModel, 'ASC' | 'DESC']> =
      options.sort ?? [['updatedAt', 'ASC']];

    return this.folderRepository.findAllCursorInWorkspaceWhereUpdatedAfter(
      createdBy,
      workspaceId,
      where,
      updatedAfter,
      options.limit,
      options.offset,
      additionalOrders,
    );
  }

  async getFolders(
    userId: FolderAttributes['userId'],
    where: Partial<FolderAttributes>,
    options: { limit: number; offset: number; sort?: SortParamsFolder } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<Folder[]> {
    const foldersWithMaybePlainName = await this.folderRepository.findAllCursor(
      { ...where, userId },
      options.limit,
      options.offset,
      options.sort,
    );

    return foldersWithMaybePlainName.map((folder) =>
      folder.plainName ? folder : this.decryptFolderName(folder),
    );
  }

  async deleteUserTrashedFoldersBatch(
    user: User,
    limit: number,
  ): Promise<number> {
    return this.folderRepository.deleteTrashedFoldersBatch(user.id, limit);
  }

  async getFoldersWithParent(
    userId: FolderAttributes['userId'],
    where: Partial<FolderAttributes>,
    options: { limit: number; offset: number; sort?: SortParamsFolder } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<Folder[]> {
    const foldersWithMaybePlainName =
      await this.folderRepository.findAllCursorWithParent(
        { ...where, userId },
        options.limit,
        options.offset,
        options.sort,
      );

    return foldersWithMaybePlainName.map((folder) =>
      folder.plainName ? folder : this.decryptFolderName(folder),
    );
  }

  async getFoldersInWorkspace(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    where: Partial<FolderAttributes>,
    options: { limit: number; offset: number; sort?: SortParamsFolder } = {
      limit: 20,
      offset: 0,
    },
  ): Promise<Folder[]> {
    const foldersWithMaybePlainName =
      await this.folderRepository.findAllCursorInWorkspace(
        createdBy,
        workspaceId,
        { ...where },
        options.limit,
        options.offset,
        options.sort,
      );

    return foldersWithMaybePlainName.map((folder) =>
      folder.plainName ? folder : this.decryptFolderName(folder),
    );
  }

  async getFoldersByParent(folderId: number, page, perPage) {
    return this.folderRepository.findAllByParentId(
      folderId,
      false,
      page,
      perPage,
    );
  }

  /**
   * Permanently deletes a folder from the database
   * @throws ForbiddenException if the user is not the owner of the folder
   * @warning This method should NOT be used unless you explicitly want to remove
   * data from the database permanently.
   */
  async deleteFolderPermanently(folder: Folder, user: User): Promise<void> {
    if (folder.userId !== user.id) {
      Logger.error(
        `User with id: ${user.id} tried to delete a folder that does not own.`,
      );
      throw new ForbiddenException(`You are not owner of this share`);
    }

    await this.folderRepository.deleteById(folder.id);
  }

  getDriveFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersCountWhere({
      userId,
      deleted: false,
    });
  }

  getTrashFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersCountWhere({
      userId,
      deleted: true,
      removed: false,
    });
  }

  getOrphanFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersWhoseParentIdDoesNotExist(userId);
  }

  async deleteOrphansFolders(userId: UserAttributes['id']): Promise<number> {
    let remainingFolders =
      await this.folderRepository.clearOrphansFolders(userId);

    if (remainingFolders > 0) {
      remainingFolders += await this.deleteOrphansFolders(userId);
    } else {
      return remainingFolders;
    }
  }

  getFolderAncestors(
    user: User,
    folderUuid: Folder['uuid'],
  ): Promise<Folder[]> {
    return this.folderRepository.getFolderAncestors(user, folderUuid);
  }

  getFolderAncestorsInWorkspace(
    user: User,
    folderUuid: Folder['uuid'],
  ): Promise<Folder[]> {
    return this.folderRepository.getFolderAncestorsInWorkspace(
      user,
      folderUuid,
    );
  }

  async moveFolder(
    user: User,
    folderUuid: Folder['uuid'],
    moveFolderDto: MoveFolderDto,
  ): Promise<Folder> {
    const { destinationFolder: destinationFolderUuid } = moveFolderDto;
    const newName = moveFolderDto.name;

    if (newName === '' || invalidName.test(newName)) {
      throw new BadRequestException('Invalid folder name');
    }

    const folder = await this.folderRepository.findOne({
      uuid: folderUuid,
    });

    if (!folder) {
      throw new NotFoundException('Folder does not exist');
    }

    if (!folder.isOwnedBy(user)) {
      throw new ForbiddenException();
    }

    if (folder.isRootFolder()) {
      throw new UnprocessableEntityException(
        'The root folder can not be moved',
      );
    }
    if (folder.removed === true) {
      throw new UnprocessableEntityException(
        `Folder ${folderUuid} can not be moved`,
      );
    }

    const parentFolder = await this.folderRepository.findOne({
      id: folder.parentId,
    });

    if (parentFolder?.isRemoved()) {
      throw new UnprocessableEntityException(
        `Folder ${folderUuid} can not be moved`,
      );
    }

    const destinationFolder = await this.getFolderByUuid(
      destinationFolderUuid,
      user,
    );

    if (destinationFolder?.isRemoved()) {
      throw new UnprocessableEntityException(
        `Folder can not be moved to ${destinationFolderUuid}`,
      );
    }

    const plainName =
      newName ?? this.cryptoService.decryptName(folder.name, folder.parentId);

    const nameEncryptedWithDestination = this.cryptoService.encryptName(
      plainName,
      destinationFolder.id,
    );

    const exists = await this.folderRepository.findByNameAndParentUuid(
      nameEncryptedWithDestination,
      plainName,
      destinationFolder.uuid,
      false,
    );

    if (exists) {
      if (exists.uuid === folder.uuid) {
        throw new ConflictException(
          `Folder ${folderUuid} was already moved to that location`,
        );
      }
      throw new ConflictException(
        'A folder with the same name already exists in destination folder',
      );
    }

    const updateData: Partial<Folder> = {
      parentId: destinationFolder.id,
      parentUuid: destinationFolder.uuid,
      name: nameEncryptedWithDestination,
      plainName,
      deleted: false,
      deletedAt: null,
    };

    const wasTrashed = folder.deleted === true;

    const updatedFolder = await this.folderRepository.updateByFolderId(
      folder.id,
      updateData,
    );

    if (wasTrashed && this.trashUsecases) {
      await this.trashUsecases.removeItemsFromTrash(
        [folderUuid],
        TrashItemType.Folder,
      );
    }

    return updatedFolder;
  }

  async renameFolder(folder: Folder, newName: string): Promise<Folder> {
    if (newName === '' || invalidName.test(newName)) {
      throw new BadRequestException('Invalid folder name');
    }

    const newEncryptedName = this.cryptoService.encryptName(
      newName,
      folder.parentId,
    );

    const exists = await this.folderRepository.findByNameAndParentUuid(
      newEncryptedName,
      newName,
      folder.parentUuid,
      false,
    );

    if (exists) {
      throw new ConflictException(
        'A folder with the same name already exists in this location',
      );
    }

    return await this.folderRepository.updateByFolderId(folder.id, {
      name: newEncryptedName,
      plainName: newName,
    });
  }

  decryptFolderName(folder: Folder): Folder {
    const decryptedName =
      folder.plainName ??
      this.cryptoService.decryptName(folder.name, folder.parentId);

    if (decryptedName === '') {
      throw new Error('Unable to decrypt folder name');
    }

    return Folder.build({
      ...folder,
      name: decryptedName,
      plainName: decryptedName,
    });
  }

  async deleteByUser(user: User, folders: Folder[]): Promise<void> {
    await this.folderRepository.deleteByUser(user, folders);
  }

  async deleteNotRootFolderByUser(
    user: User,
    folders: Folder[],
  ): Promise<void> {
    const isRootFolder = folders.some(
      (folder) => folder.id === user.rootFolderId || folder.parentId === null,
    );
    if (isRootFolder) {
      throw new NotAcceptableException('Cannot delete root folder');
    }
    await this.folderRepository.deleteByUser(user, folders);
  }

  getFolderSizeByUuid(
    folderUuid: Folder['uuid'],
    includeTrashedFiles = true,
  ): Promise<number> {
    return this.folderRepository.calculateFolderSize(
      folderUuid,
      includeTrashedFiles,
    );
  }

  async getFolderStats(
    user: User,
    folderUuid: Folder['uuid'],
  ): Promise<FolderStatsDto> {
    const folder = await this.getFolderByUuidAndUser(folderUuid, user);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.folderRepository.calculateFolderStats(folderUuid);
  }

  async getFolderMetadataByPath(
    user: UserAttributes,
    path: string,
  ): Promise<Folder | null> {
    const rootFolder = await this.getFolderByUserId(user.rootFolderId, user.id);
    if (!rootFolder) {
      throw new NotFoundException('Root Folder not found');
    }

    try {
      return await this.folderRepository.getFolderByPath(
        user.id,
        path,
        rootFolder.uuid,
      );
    } catch (error) {
      if (error.message === 'Query timed out') {
        throw new RequestTimeoutException('Folder metadata search timed out');
      }
      throw error;
    }
  }

  async updateByFolderIdAndForceUpdatedAt(
    folder: Folder,
    folderData: Partial<FolderAttributes>,
  ): Promise<Folder> {
    const updatedFields = { ...folderData };

    if (!updatedFields.updatedAt) {
      updatedFields.updatedAt = new Date();
    }

    return this.folderRepository.updateById(folder.id, updatedFields);
  }
}
