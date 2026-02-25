import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { v4, validate as validateUuid } from 'uuid';

import {
  type Item,
  Role,
  SharedWithType,
  Sharing,
  type SharingActionName,
  type SharingAttributes,
  SharingInvite,
  type SharingRole,
  SharingType,
} from './sharing.domain';
import { ReferralKey, type User } from '../user/user.domain';
import { type CreateInviteDto } from './dto/create-invite.dto';
import { SequelizeSharingRepository } from './sharing.repository';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { File, type FileAttributes, FileStatus } from '../file/file.domain';
import { type Folder } from '../folder/folder.domain';
import { UserNotFoundError, UserUseCases } from '../user/user.usecase';
import { type AcceptInviteDto } from './dto/accept-invite.dto';
import { type UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import getEnv from '../../config/configuration';
import {
  generateTokenWithPlainSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import {
  type FileWithSharedInfo,
  type FolderWithSharedInfo,
  type GetFilesResponse,
  type GetFoldersReponse,
  type GetItemsReponse,
} from './dto/get-items-and-shared-folders.dto';
import { type GetInviteDto, type GetInvitesDto } from './dto/get-invites.dto';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../externals/mailer/mailer.service';
import { Sign } from '../../middlewares/passport';
import { type CreateSharingDto } from './dto/create-sharing.dto';
import { aes } from '@internxt/lib';
import { Environment } from '@internxt/inxt-js';
import { SequelizeUserReferralsRepository } from '../user/user-referrals.repository';
import { SharingNotFoundException } from './exception/sharing-not-found.exception';
import { type Workspace } from '../workspaces/domains/workspaces.domain';
import { type WorkspaceTeamAttributes } from '../workspaces/attributes/workspace-team.attributes';
import { type ItemSharingInfoDto } from './dto/response/get-item-sharing-info.dto';
import {
  type GetFilesInSharedFolderResponseDto,
  type GetFoldersInSharedFolderResponseDto,
} from './dto/response/get-folders-in-shared-folder.dto';
import { SequelizeFileRepository } from '../file/file.repository';

class UserAlreadyHasRole extends BadRequestException {
  constructor() {
    super('User already has a role');
    Object.setPrototypeOf(this, UserAlreadyHasRole.prototype);
  }
}

class OwnerCannotBeSharedWithError extends BadRequestException {
  constructor() {
    super('Owner cannot share the folder with itself');
    Object.setPrototypeOf(this, OwnerCannotBeSharedWithError.prototype);
  }
}

class OwnerCannotBeRemovedWithError extends Error {
  constructor() {
    super('Owner cannot be removed from the item sharing');
    Object.setPrototypeOf(this, OwnerCannotBeRemovedWithError.prototype);
  }
}

class InvalidPermissionsError extends ForbiddenException {
  constructor() {
    super('You dont have permissions on this item');
    Object.setPrototypeOf(this, InvalidPermissionsError.prototype);
  }
}

class SharedFolderInTheTrashError extends ForbiddenException {
  constructor() {
    super('This folder is in the trash');
    Object.setPrototypeOf(this, SharedFolderInTheTrashError.prototype);
  }
}

class SharedFolderRemovedError extends ForbiddenException {
  constructor() {
    super('This folder has been removed');
    Object.setPrototypeOf(this, SharedFolderRemovedError.prototype);
  }
}

export class PasswordNeededError extends ForbiddenException {
  constructor() {
    super('Password Needed for protected sharings');
    Object.setPrototypeOf(this, PasswordNeededError.prototype);
  }
}

export type SharingInfo = Pick<
  User,
  'name' | 'lastname' | 'uuid' | 'avatar' | 'email'
> & {
  sharingId: Sharing['id'];
  role: {
    name: Role['name'];
    id: Role['id'];
    createdAt: Date;
    updatedAt: Date;
  };
};

type PublicSharingInfo = Pick<
  Sharing,
  | 'itemType'
  | 'itemId'
  | 'encryptionAlgorithm'
  | 'encryptionKey'
  | 'createdAt'
  | 'updatedAt'
  | 'type'
> & { item: Item; itemToken: string };

type SharingItemInfo = Pick<Item, 'plainName' | 'type' | 'size'>;

@Injectable()
export class SharingService {
  constructor(
    private readonly sharingRepository: SequelizeSharingRepository,
    private readonly fileRepository: SequelizeFileRepository,
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUsecases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUsecases: FolderUseCases,
    private readonly usersUsecases: UserUseCases,
    private readonly configService: ConfigService,
    private readonly userReferralsRepository: SequelizeUserReferralsRepository,
  ) {}

  findSharingBy(where: Partial<Sharing>): Promise<Sharing | null> {
    return this.sharingRepository.findOneSharingBy(where);
  }

  findSharingsBySharedWithAndAttributes(
    sharedWithValues: Sharing['sharedWith'][],
    filters: Omit<Partial<Sharing>, 'sharedWith'> = {},
    options?: { offset: number; limit: number; givePriorityToRole?: string },
  ): Promise<Sharing[]> {
    return this.sharingRepository.findSharingsBySharedWithAndAttributes(
      sharedWithValues,
      filters,
      options,
    );
  }

  findSharingRoleBy(where: Partial<SharingRole>) {
    return this.sharingRepository.findSharingRoleBy(where);
  }

  async isItemBeingSharedAboveTheLimit(
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    type: Sharing['type'],
    sharedWithType = SharedWithType.Individual,
  ): Promise<boolean> {
    const [sharingsCountForThisItem, invitesCountForThisItem] =
      await Promise.all([
        this.sharingRepository.getSharingsCountBy({
          itemId,
          itemType,
          type,
          sharedWithType,
        }),
        this.sharingRepository.getInvitesCountBy({
          itemId,
          itemType,
        }),
      ]);

    const limit = 100;
    const count = sharingsCountForThisItem + invitesCountForThisItem;

    return count >= limit;
  }

  async getPublicSharingById(
    id: Sharing['id'],
    code: string,
    plainPassword?: string,
  ): Promise<PublicSharingInfo> {
    const sharing = await this.sharingRepository.findOneSharing({
      id,
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    if (!sharing.isPublic()) {
      throw new ForbiddenException();
    }

    if (sharing.isProtected() && !plainPassword) {
      throw new PasswordNeededError();
    }

    if (sharing.isProtected()) {
      const decryptedPassword = aes.decrypt(sharing.encryptedPassword, code);
      if (decryptedPassword !== plainPassword) {
        throw new ForbiddenException();
      }
    }

    const response: Partial<PublicSharingInfo> = { ...sharing };

    const owner = await this.usersUsecases.getUser(sharing.ownerId);

    let item: Item;

    if (sharing.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(sharing.itemId);
      if (item.isDeleted()) {
        throw new NotFoundException();
      }
      const network = new Environment({
        bridgePass: owner.userId,
        bridgeUser: owner.bridgeUser,
        bridgeUrl: getEnv().apis.storage.url,
        appDetails: {
          clientName: 'drive-server-wip',
          clientVersion: '1.0.0',
        },
      });
      const fileInfo = await network.getFileInfo(item.bucket, item.fileId);

      const encryptionKey = await Environment.utils.generateFileKey(
        aes.decrypt(sharing.encryptionKey, code),
        item.bucket,
        Buffer.from(fileInfo.index, 'hex'),
      );
      response['itemToken'] = await network.createFileToken(
        item.bucket,
        item.fileId,
        'PULL',
      );

      response.encryptionKey = encryptionKey.toString('hex');
    } else {
      item = await this.folderUsecases.getByUuid(sharing.itemId);
      if (item.isRemoved()) {
        throw new NotFoundException();
      }
    }

    if (!item.plainName) {
      if (sharing.itemType === 'file') {
        item.plainName = this.fileUsecases.decrypFileName(
          item as File,
        ).plainName;
      } else {
        item.plainName = this.folderUsecases.decryptFolderName(
          item as Folder,
        ).plainName;
      }
    }

    response['item'] = item;

    return response as PublicSharingInfo;
  }

  async getPublicSharingItemInfo(id: Sharing['id']): Promise<SharingItemInfo> {
    const sharing = await this.sharingRepository.findOneSharing({
      id,
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    if (!sharing.isPublic()) {
      throw new ForbiddenException();
    }

    let item: Item;
    if (sharing.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(sharing.itemId);
      if (item.isDeleted()) {
        throw new NotFoundException();
      }
    } else {
      item = await this.folderUsecases.getByUuid(sharing.itemId);
      if (item.isRemoved()) {
        throw new NotFoundException();
      }
    }

    if (!item.plainName) {
      if (item instanceof File) {
        item.plainName = this.fileUsecases.decrypFileName(item).plainName;
      } else {
        item.plainName = this.folderUsecases.decryptFolderName(item).plainName;
      }
    }
    return {
      plainName: item.plainName,
      type: item.type,
      size: item.size,
    };
  }

  async setSharingPassword(
    user: User,
    id: Sharing['id'],
    encryptedPassword: string,
  ): Promise<Sharing> {
    const sharing = await this.sharingRepository.findOneSharing({
      id,
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    if (!sharing.isPublic() || !sharing.isOwnedBy(user)) {
      throw new BadRequestException();
    }

    sharing.encryptedPassword = encryptedPassword;

    await this.sharingRepository.updateSharing({ id: sharing.id }, sharing);

    return sharing;
  }

  async removeSharingPassword(user: User, id: Sharing['id']): Promise<Sharing> {
    const sharing = await this.sharingRepository.findOneSharing({
      id,
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    if (!sharing.isPublic() || !sharing.isOwnedBy(user)) {
      throw new BadRequestException();
    }

    sharing.encryptedPassword = null;
    await this.sharingRepository.updateSharing({ id: sharing.id }, sharing);

    return sharing;
  }

  async getInvites(
    user: User,
    itemType: Sharing['itemType'],
    itemId: Sharing['itemId'],
  ): Promise<GetInvitesDto> {
    let item: Item | null;

    if (itemType === 'file') {
      item = await this.fileUsecases.getByUuid(itemId);
    } else if (itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(itemId);
    }

    if (!item) {
      throw new NotFoundException();
    }

    const isUserTheOwner = item.isOwnedBy(user);

    if (!isUserTheOwner) {
      throw new ForbiddenException();
    }

    return this.sharingRepository.getInvites(
      {
        itemId,
        itemType,
      },
      100,
      0,
    );
  }

  async getInvitesByUser(
    user: User,
    limit: number,
    offset: number,
  ): Promise<(GetInviteDto & { item: File | Folder })[]> {
    const invites = await this.sharingRepository.getUserValidInvites(
      { sharedWith: user.uuid },
      limit,
      offset,
    );

    const folderInvites = invites.filter(
      (invite) => invite.itemType === 'folder',
    );

    const fileInvites = invites.filter((invite) => invite.itemType === 'file');

    const [folders, files] = await Promise.all([
      folderInvites.length === 0
        ? []
        : this.folderUsecases.getByUuids(
            folderInvites.map((invite) => invite.itemId),
          ),
      fileInvites.length === 0
        ? []
        : this.fileUsecases.getByUuids(
            fileInvites.map((invite) => invite.itemId),
          ),
    ]);

    return Promise.all(
      invites.map(async (invite) => {
        const item: File | Folder =
          invite.itemType === 'folder'
            ? folders.find((folder) => folder.uuid === invite.itemId)
            : files.find((file) => file.uuid === invite.itemId);

        return {
          ...invite,
          invited: {
            ...invite.invited,
            // avatar: invite.invited.avatar
            //   ? await this.usersUsecases.getAvatarUrl(invite.invited.avatar)
            //   : null,
            avatar: null,
          },
          item,
        };
      }),
    );
  }

  async getFoldersFromPublicFolder(
    folderId: Folder['uuid'],
    token: string | null,
    page: number,
    perPage: number,
  ): Promise<GetFoldersReponse> {
    const getFolderContent = async (
      userId: User['id'],
      folderId: Folder['id'],
    ) => {
      const folders = (
        await this.folderUsecases.getFoldersWithParent(
          userId,
          {
            parentId: folderId,
            deleted: false,
            removed: false,
          },
          {
            limit: perPage,
            offset: page * perPage,
          },
        )
      ).map((folder) => {
        return {
          ...folder,
          encryptionKey: null,
          dateShared: null,
          sharedWithMe: null,
        };
      }) as FolderWithSharedInfo[];

      return folders;
    };
    const folder = await this.folderUsecases.getByUuid(folderId);

    if (folder.isTrashed()) {
      throw new SharedFolderInTheTrashError();
    }

    if (folder.isRemoved()) {
      throw new SharedFolderRemovedError();
    }

    const parentFolder = folder.parentId
      ? await this.folderUsecases.getFolder(folder.parentId)
      : null;

    const requestedFolderIsSharedRootFolder = !token;

    const decoded = requestedFolderIsSharedRootFolder
      ? null
      : (verifyWithDefaultSecret(token) as
          | {
              sharedRootFolderId: Folder['uuid'];
              parentFolderId: Folder['parent']['uuid'];
              folder: {
                uuid: Folder['uuid'];
                id: Folder['id'];
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

    const sharing = await this.sharingRepository.findOneSharing({
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
      itemType: 'folder',
    });

    const owner = await this.usersUsecases.getUser(sharing.ownerId);

    if (!requestedFolderIsSharedRootFolder) {
      const navigationUp = folder.uuid === decoded.parentFolderId;
      const navigationDown = folder.parentId === decoded.folder.id;
      const navigationUpFromSharedFolder =
        navigationUp && decoded.sharedRootFolderId === decoded.folder.uuid;

      if (navigationUpFromSharedFolder) {
        throw new ForbiddenException(
          'User does not have access to this folder',
        );
      }

      if (!navigationDown && !navigationUp) {
        throw new ForbiddenException(
          'User does not have access to this folder',
        );
      }
    }

    const [ownerRootFolder, items] = await Promise.all([
      this.folderUsecases.getFolderByUserId(owner.rootFolderId, owner.id),
      getFolderContent(owner.id, folder.id),
    ]);

    return {
      items,
      credentials: {
        networkPass: owner.userId,
        networkUser: owner.bridgeUser,
      },
      token: generateTokenWithPlainSecret(
        {
          sharedRootFolderId: sharing.itemId,
          parentFolderId: parentFolder?.uuid || null,
          folder: {
            uuid: folder.uuid,
            id: folder.id,
          },
          owner: {
            id: owner.id,
            uuid: owner.uuid,
          },
        },
        '1d',
        getEnv().secrets.jwt,
      ),
      bucket: ownerRootFolder.bucket,
      encryptionKey: sharing.encryptionKey,
      parent: {
        uuid: parentFolder?.uuid || null,
        name: parentFolder?.plainName || null,
      },
      name: folder.name,
      role: 'NONE',
    };
  }

  async getFilesFromPublicFolder(
    folderId: Folder['uuid'],
    token: string | null,
    code: string,
    page: number,
    perPage: number,
  ): Promise<GetFilesResponse> {
    const getFilesFromFolder = async (
      userId: User['id'],
      folderId: Folder['id'],
    ) => {
      const files = (
        await this.fileUsecases.getFiles(
          userId,
          {
            folderId: folderId,
            status: FileStatus.EXISTS,
          },
          {
            limit: perPage,
            offset: page * perPage,
          },
        )
      ).map((file) => {
        return {
          ...file,
          encryptionKey: null,
          dateShared: null,
          sharedWithMe: null,
        };
      }) as FileWithSharedInfo[];

      return files;
    };
    const folder = await this.folderUsecases.getByUuid(folderId);

    if (folder.isTrashed()) {
      throw new SharedFolderInTheTrashError();
    }

    if (folder.isRemoved()) {
      throw new SharedFolderRemovedError();
    }

    const parentFolder = folder.parentId
      ? await this.folderUsecases.getFolder(folder.parentId)
      : null;

    const requestedFolderIsSharedRootFolder = !token;

    const decoded = requestedFolderIsSharedRootFolder
      ? null
      : (verifyWithDefaultSecret(token) as
          | {
              sharedRootFolderId: Folder['uuid'];
              parentFolderId: Folder['parent']['uuid'];
              folder: {
                uuid: Folder['uuid'];
                id: Folder['id'];
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

    const sharing = await this.sharingRepository.findOneSharing({
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
      itemType: 'folder',
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    const owner = await this.usersUsecases.getUser(sharing.ownerId);

    if (!requestedFolderIsSharedRootFolder) {
      const navigationUp = folder.uuid === decoded.parentFolderId;
      const navigationDown = folder.parentId === decoded.folder.id;
      const insideTheSharedRootFolder =
        decoded.sharedRootFolderId === decoded.folder.uuid;

      if (
        (!navigationDown && !navigationUp) ||
        (navigationUp && insideTheSharedRootFolder)
      ) {
        throw new NotFoundException();
      }
    }

    const [ownerRootFolder, items] = await Promise.all([
      this.folderUsecases.getFolderByUserId(owner.rootFolderId, owner.id),
      getFilesFromFolder(owner.id, folder.id),
    ]);

    const network = new Environment({
      bridgePass: owner.userId,
      bridgeUser: owner.bridgeUser,
      bridgeUrl: getEnv().apis.storage.url,
      appDetails: {
        clientName: 'drive-server-wip',
        clientVersion: '1.0.0',
      },
    });

    const encryptionPromises = items.map(async (file) => {
      const encryptionKey = await this.fileUsecases.getEncryptionKeyFromFile(
        file,
        sharing.encryptionKey,
        code,
        network,
      );

      file.encryptionKey = encryptionKey;
      return file;
    });

    await Promise.all(encryptionPromises);

    return {
      items,
      credentials: {
        networkPass: owner.userId,
        networkUser: owner.bridgeUser,
      },
      token: generateTokenWithPlainSecret(
        {
          sharedRootFolderId: sharing.itemId,
          parentFolderId: parentFolder?.uuid || null,
          folder: {
            uuid: folder.uuid,
            id: folder.id,
          },
          owner: {
            id: owner.id,
            uuid: owner.uuid,
          },
        },
        '1d',
        getEnv().secrets.jwt,
      ),
      bucket: ownerRootFolder.bucket,
      encryptionKey: null,
      parent: {
        uuid: parentFolder?.uuid || null,
        name: parentFolder?.plainName || null,
      },
      name: folder.name,
      role: 'NONE',
    };
  }

  async getFoldersInSharedFolder(
    folderId: Folder['uuid'],
    token: string | null,
    user: User,
    page: number,
    perPage: number,
  ): Promise<GetFoldersInSharedFolderResponseDto> {
    const getFolderContent = async (owner: User, folderId: Folder['uuid']) => {
      const ownerInfo = await this.mapUserToSharingOwnerInfo(owner);

      const folders = await this.folderUsecases.getFoldersWithParent(
        owner.id,
        {
          parentUuid: folderId,
          deleted: false,
          removed: false,
        },
        {
          limit: perPage,
          offset: page * perPage,
        },
      );
      return folders.map((f) => ({
        ...f,
        user: ownerInfo,
      }));
    };

    const folder = await this.folderUsecases.getByUuid(folderId);

    if (folder.isTrashed()) {
      throw new SharedFolderInTheTrashError();
    }

    if (folder.isRemoved()) {
      throw new SharedFolderRemovedError();
    }

    const parentFolder = folder.parentId
      ? await this.folderUsecases.getFolder(folder.parentId)
      : null;

    if (folder.isOwnedBy(user)) {
      return {
        items: await getFolderContent(user, folder.uuid),
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
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
      : this.verifyAndDecodeSharingToken(token);

    const sharing = await this.sharingRepository.findOneSharing({
      sharedWith: user.uuid,
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
      sharedWithType: SharedWithType.Individual,
    });

    if (!sharing) {
      throw new ForbiddenException('User does not have access to this folder');
    }

    const owner = await this.usersUsecases.getUser(sharing.ownerId);

    if (!requestedFolderIsSharedRootFolder) {
      const navigationUp = folder.uuid === decoded.parentFolderId;
      const navigationDown = folder.parentId === decoded.folder.id;
      const navigationUpFromSharedFolder =
        navigationUp && decoded.sharedRootFolderId === decoded.folder.uuid;

      if (navigationUpFromSharedFolder) {
        throw new ForbiddenException(
          'User does not have access to this folder',
        );
      }

      if (!navigationDown && !navigationUp) {
        throw new ForbiddenException(
          'User does not have access to this folder',
        );
      }
    }

    const [ownerRootFolder, items, sharingRole] = await Promise.all([
      this.folderUsecases.getFolderByUserId(owner.rootFolderId, owner.id),
      getFolderContent(owner, folder.uuid),
      this.sharingRepository.findSharingRoleBy({ sharingId: sharing.id }),
    ]);

    return {
      items,
      credentials: {
        networkPass: owner.userId,
        networkUser: owner.bridgeUser,
      },
      token: this.createSharedFolderToken(
        owner,
        sharing.itemId,
        folder,
        parentFolder,
      ),
      bucket: ownerRootFolder.bucket,
      encryptionKey: sharing.encryptionKey,
      parent: {
        uuid: parentFolder?.uuid || null,
        name: parentFolder?.plainName || null,
      },
      name: folder.plainName,
      role: sharingRole.role.name,
    };
  }

  async getFilesInSharedFolder(
    folderId: Folder['uuid'],
    token: string | null,
    user: User,
    page: number,
    perPage: number,
  ): Promise<GetFilesInSharedFolderResponseDto> {
    const getFilesFromFolder = async (
      owner: User,
      folderUuid: Folder['uuid'],
    ) => {
      const ownerInfo = await this.mapUserToSharingOwnerInfo(owner);

      const files = await this.fileUsecases.getFiles(
        owner.id,
        {
          folderUuid,
          status: FileStatus.EXISTS,
        },
        {
          limit: perPage,
          offset: page * perPage,
        },
      );
      return files.map((file) => {
        return {
          ...file,
          user: ownerInfo,
        };
      });
    };

    const folder = await this.folderUsecases.getByUuid(folderId);

    if (folder.isTrashed()) {
      throw new SharedFolderInTheTrashError();
    }

    if (folder.isRemoved()) {
      throw new SharedFolderRemovedError();
    }

    const parentFolder = folder.parentId
      ? await this.folderUsecases.getFolder(folder.parentId)
      : null;

    if (folder.isOwnedBy(user)) {
      return {
        items: await getFilesFromFolder(user, folder.uuid),
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
        bucket: '',
        encryptionKey: null,
        parent: {
          uuid: parentFolder?.uuid || null,
          name: parentFolder?.plainName || null,
        },
        name: folder.plainName,
        role: 'OWNER',
      };
    }

    const requestedFolderIsSharedRootFolder = !token;

    const decoded = requestedFolderIsSharedRootFolder
      ? null
      : this.verifyAndDecodeSharingToken(token);

    const sharing = await this.sharingRepository.findOneSharing({
      sharedWith: user.uuid,
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
      sharedWithType: SharedWithType.Individual,
    });

    if (!sharing) {
      throw new ForbiddenException('User does not have access to this folder');
    }

    const owner = await this.usersUsecases.getUser(sharing.ownerId);

    if (!requestedFolderIsSharedRootFolder) {
      const navigationUp = folder.uuid === decoded.parentFolderId;
      const navigationDown = folder.parentId === decoded.folder.id;
      const insideTheSharedRootFolder =
        decoded.sharedRootFolderId === decoded.folder.uuid;

      if (
        (!navigationDown && !navigationUp) ||
        (navigationUp && insideTheSharedRootFolder)
      ) {
        throw new ForbiddenException(
          'User does not have access to this folder',
        );
      }
    }

    const [ownerRootFolder, items, sharingRole] = await Promise.all([
      this.folderUsecases.getFolderByUserId(owner.rootFolderId, owner.id),
      getFilesFromFolder(owner, folder.uuid),
      this.sharingRepository.findSharingRoleBy({ sharingId: sharing.id }),
    ]);

    return {
      items,
      credentials: {
        networkPass: owner.userId,
        networkUser: owner.bridgeUser,
      },
      token: this.createSharedFolderToken(
        owner,
        sharing.itemId,
        folder,
        parentFolder,
      ),
      name: folder.plainName,
      bucket: ownerRootFolder.bucket,
      encryptionKey: sharing.encryptionKey,
      parent: {
        uuid: parentFolder?.uuid || null,
        name: parentFolder?.plainName || null,
      },
      role: sharingRole.role.name,
    };
  }

  private createSharedFolderToken(
    owner: User,
    sharedFolderUuid: string,
    folder: Folder,
    parentFolder: Folder,
  ): string {
    return generateTokenWithPlainSecret(
      {
        sharedRootFolderId: sharedFolderUuid,
        sharedWithType: SharedWithType.Individual,
        parentFolderId: parentFolder?.uuid || null,
        folder: {
          uuid: folder.uuid,
          id: folder.id,
        },
        owner: {
          id: owner.id,
          uuid: owner.uuid,
        },
      },
      '1d',
      getEnv().secrets.jwt,
    );
  }

  private verifyAndDecodeSharingToken(token: string) {
    const decoded = verifyWithDefaultSecret(token) as
      | {
          sharedRootFolderId: Folder['uuid'];
          parentFolderId: Folder['parent']['uuid'];
          folder: {
            uuid: Folder['uuid'];
            id: Folder['id'];
          };
          owner: {
            id: User['id'];
            uuid: User['uuid'];
          };
        }
      | string;

    if (typeof decoded === 'string') {
      throw new ForbiddenException('Invalid token');
    }

    return decoded;
  }

  private async mapUserToSharingOwnerInfo(
    user: Pick<
      User,
      'avatar' | 'bridgeUser' | 'lastname' | 'name' | 'userId' | 'uuid'
    >,
  ) {
    const avatar = user?.avatar
      ? await this.usersUsecases.getAvatarUrl(user.avatar)
      : null;

    return {
      bridgeUser: user.bridgeUser,
      userId: user.userId,
      uuid: user.uuid,
      name: user.name,
      lastname: user.lastname,
      avatar: avatar,
    };
  }

  async createInvite(
    user: User,
    createInviteDto: CreateInviteDto,
  ): Promise<SharingInvite> {
    if (createInviteDto.sharedWith === user.email) {
      throw new OwnerCannotBeSharedWithError();
    }

    const isAnInvitation = createInviteDto.type === 'OWNER';
    const isARequestToJoin = createInviteDto.type === 'SELF';

    if (!isAnInvitation && !isARequestToJoin) {
      throw new BadRequestException();
    }

    if (isAnInvitation) {
      if (
        !createInviteDto.encryptionAlgorithm ||
        !createInviteDto.encryptionKey
      ) {
        throw new BadRequestException(
          'Encryption algorithm and encryption key are required',
        );
      }
    }

    const [existentUser, preCreatedUser] = await Promise.all([
      this.usersUsecases.findByEmail(createInviteDto.sharedWith),
      this.usersUsecases.findPreCreatedByEmail(createInviteDto.sharedWith),
    ]);

    const userJoining = existentUser ?? preCreatedUser;

    if (!userJoining) {
      throw new NotFoundException('Invited user not found');
    }

    const isUserPreCreated = !existentUser;

    const [invitation, sharing] = await Promise.all([
      this.sharingRepository.getInviteByItemAndUser(
        createInviteDto.itemId,
        createInviteDto.itemType,
        userJoining.uuid,
      ),
      this.sharingRepository.findOneSharing({
        itemId: createInviteDto.itemId,
        itemType: createInviteDto.itemType,
        sharedWith: userJoining.uuid,
        sharedWithType: SharedWithType.Individual,
      }),
    ]);

    const userAlreadyInvited = invitation !== null;
    const userAlreadyJoined = sharing !== null;

    if (userAlreadyInvited || userAlreadyJoined) {
      throw new UserAlreadyHasRole();
    }

    let item: Item;

    if (createInviteDto.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(createInviteDto.itemId);
    } else if (createInviteDto.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(createInviteDto.itemId);
    } else {
      throw new BadRequestException('Wrong "itemType" param');
    }
    const resourceIsOwnedByUser = item.isOwnedBy(user);

    if (!resourceIsOwnedByUser) {
      throw new ForbiddenException(
        'User does not have permission to share this item',
      );
    }

    const expirationAt = new Date();
    expirationAt.setDate(expirationAt.getDate() + 2);

    const invite = SharingInvite.build({
      id: v4(),
      ...createInviteDto,
      sharedWith: userJoining.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
      expirationAt: isUserPreCreated ? expirationAt : null,
    });

    const tooManyTimesShared = await this.isItemBeingSharedAboveTheLimit(
      createInviteDto.itemId,
      createInviteDto.itemType,
      SharingType.Private,
    );

    if (tooManyTimesShared) {
      throw new BadRequestException('Limit for sharing an item reach');
    }

    const shouldRemoveOtherSharings = !createInviteDto.persistPreviousSharing;

    if (shouldRemoveOtherSharings) {
      await this.removeItemFromBeingShared(
        createInviteDto.itemType,
        createInviteDto.itemId,
        SharingType.Public,
      );
    }

    const createdInvite = await this.sharingRepository.createInvite(invite);

    if (createInviteDto.notifyUser && !isUserPreCreated) {
      const authToken = Sign(
        this.usersUsecases.getNewTokenPayload(userJoining),
        this.configService.get('secrets.jwt'),
      );
      new MailerService(this.configService)
        .sendInvitationToSharingReceivedEmail(
          user.email,
          userJoining.email,
          item.plainName,
          {
            acceptUrl: `${this.configService.get(
              'clients.drive.web',
            )}/sharings/${createdInvite.id}/accept?token=${authToken}`,
            declineUrl: `${this.configService.get(
              'clients.drive.web',
            )}/sharings/${createdInvite.id}/decline?token=${authToken}`,
            message: createInviteDto.notificationMessage || '',
          },
        )
        .catch(() => {
          // no op
        });
    }

    if (isUserPreCreated) {
      const encodedUserEmail = encodeURIComponent(userJoining.email);
      try {
        await new MailerService(
          this.configService,
        ).sendInvitationToSharingGuestEmail(
          user.email,
          userJoining.email,
          item.plainName,
          {
            signUpUrl: `${this.configService.get(
              'clients.drive.web',
            )}/shared-guest?invitation=${
              createdInvite.id
            }&email=${encodedUserEmail}`,
            message: createInviteDto.notificationMessage || '',
          },
        );
      } catch (error) {
        Logger.error(
          `[SHARING/GUESTUSEREMAIL] Error sending email pre created userId: ${
            userJoining.uuid
          }, error: ${JSON.stringify(error)}`,
        );
        await this.sharingRepository.deleteInvite(createdInvite);
        throw error;
      }
    }

    return createdInvite;
  }

  async createPublicSharing(
    user: User,
    dto: CreateSharingDto,
  ): Promise<Sharing> {
    let item: Item;

    if (!dto.encryptedCode) {
      throw new BadRequestException(
        'The "encryptedCode" is required when the sharing "type" is public',
      );
    }

    if (dto.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(dto.itemId);
    } else if (dto.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(dto.itemId);
    } else {
      throw new BadRequestException('Wrong item type');
    }

    const newSharing = Sharing.build({
      ...dto,
      id: v4(),
      sharedWith: '00000000-0000-0000-0000-000000000000',
      type: SharingType.Public,
      ownerId: user.uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const shouldRemoveOtherSharings = !dto.persistPreviousSharing;

    if (shouldRemoveOtherSharings) {
      await this.removeItemFromBeingShared(
        dto.itemType,
        dto.itemId,
        SharingType.Private,
      );
    }

    const sharing = await this.sharingRepository.findOneSharingBy({
      itemId: dto.itemId,
      itemType: dto.itemType,
      type: SharingType.Public,
    });

    if (!item.isOwnedBy(user) && !sharing) {
      throw new ForbiddenException();
    }

    if (sharing) {
      return sharing;
    }

    const sharingCreated =
      await this.sharingRepository.createSharing(newSharing);

    this.userReferralsRepository
      .applyUserReferral(user.id, ReferralKey.ShareFile)
      .catch((err) => {
        Logger.error(
          'userReferralsRepository.applyUserReferral: share-file',
          JSON.stringify(err),
        );
      });

    return sharingCreated;
  }

  private async removeItemFromBeingShared(
    itemType: Sharing['itemType'],
    itemId: Sharing['itemId'],
    type: Sharing['type'],
    sharedWithType: SharedWithType = SharedWithType.Individual,
  ) {
    if (type === SharingType.Private) {
      await this.sharingRepository.deleteInvitesBy({
        itemId,
        itemType,
      });
    }

    await this.sharingRepository.deleteSharingsBy({
      itemId,
      itemType,
      type,
      sharedWithType,
    });
  }

  async acceptInvite(
    user: User,
    inviteId: SharingInvite['id'],
    acceptInviteDto: AcceptInviteDto,
  ) {
    const invite = await this.sharingRepository.getInviteById(inviteId);

    if (!invite) {
      throw new NotFoundException();
    }

    if (!invite.isSharedWith(user)) {
      throw new ForbiddenException();
    }

    if (invite.isARequest()) {
      if (
        !acceptInviteDto.encryptionAlgorithm ||
        !acceptInviteDto.encryptionKey
      ) {
        throw new BadRequestException(
          'This invitation is a request, the encryption key is required',
        );
      }
    }

    let item: Item;

    if (invite.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(invite.itemId);
    } else if (invite.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(invite.itemId);
    } else {
      throw new BadRequestException('Wrong invitation item type');
    }

    const owner = await this.usersUsecases.findById(item.userId);

    if (!owner) {
      throw new NotFoundException('Owner of this resource not found');
    }

    const newSharing = Sharing.build({
      ...invite,
      id: v4(),
      type: SharingType.Private,
      ownerId: owner.uuid,
      encryptionAlgorithm: invite.isARequest()
        ? acceptInviteDto.encryptionAlgorithm
        : invite.encryptionAlgorithm,
      encryptionKey: invite.isARequest()
        ? acceptInviteDto.encryptionKey
        : invite.encryptionKey,
    });
    const sharing = await this.sharingRepository.createSharing(newSharing);
    await this.sharingRepository.createSharingRole({
      createdAt: new Date(),
      updatedAt: new Date(),
      roleId: invite.roleId,
      sharingId: sharing.id,
    });
    await this.sharingRepository.deleteInvite(invite);
  }

  async removeInvite(user: User, id: SharingInvite['id']) {
    const invite = await this.sharingRepository.getInviteById(id);

    if (!invite) {
      throw new UserNotFoundError();
    }

    let item: Item;

    if (invite.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(invite.itemId);
    } else if (invite.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(invite.itemId);
    } else {
      throw new BadRequestException('Wrong invitation item type');
    }

    if (!item) {
      throw new NotFoundException('Item associated to the invite not found');
    }

    const isUserTheOwnerOfTheResource = item.isOwnedBy(user);
    const isAnInvitedUser = invite.isSharedWith(user);

    if (!isUserTheOwnerOfTheResource && !isAnInvitedUser) {
      throw new ForbiddenException();
    }

    await this.sharingRepository.deleteInvite(invite);
  }

  async removeSharing(
    user: User,
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
  ) {
    const sharing = await this.sharingRepository.findOneSharing({
      itemId,
      itemType,
    });

    if (!sharing) {
      return;
    }

    if (!sharing.isOwnedBy(user)) {
      throw new ForbiddenException();
    }

    await this.sharingRepository.deleteInvitesBy({
      itemId,
      itemType,
    });
    await this.sharingRepository.deleteSharingsBy({
      itemId,
      itemType,
    });
  }

  async bulkRemoveSharings(
    user: User,
    itemIds: Sharing['itemId'][],
    itemType: Sharing['itemType'],
    sharedWithType: SharedWithType = SharedWithType.Individual,
  ) {
    await this.sharingRepository.bulkDeleteInvites(itemIds, itemType);
    await this.sharingRepository.bulkDeleteSharings(
      user.uuid,
      itemIds,
      itemType,
      sharedWithType,
    );
  }

  async getRoles(): Promise<Role[]> {
    return this.sharingRepository.findRoles();
  }

  async getUserRole(sharingId: Sharing['id'], user: User): Promise<any> {
    const sharing = await this.sharingRepository.findOneSharing({
      id: sharingId,
    });

    if (!sharing) {
      throw new NotFoundException();
    }

    if (sharing.isOwnedBy(user)) {
      return {
        ...Role.build({
          id: v4(),
          createdAt: sharing.createdAt,
          name: 'OWNER',
          updatedAt: sharing.updatedAt,
        }),
        sharingId: sharing.id,
      };
    }

    const sharingRole = await this.sharingRepository.findSharingRoleBy({
      sharingId: sharing.id,
    });

    if (!sharingRole) {
      throw new NotFoundException();
    }

    const role = await this.sharingRepository.findRoleBy({
      id: sharingRole.roleId,
    });

    return { ...role, sharingId: sharing.id };
  }

  async updateSharingRole(
    user: User,
    id: Sharing['id'],
    dto: UpdateSharingRoleDto,
  ): Promise<void> {
    const sharing = await this.sharingRepository.findSharingById(id);

    if (!sharing) {
      throw new NotFoundException();
    }

    let sharedItem: Item;

    if (sharing.itemType === 'file') {
      sharedItem = await this.fileUsecases.getByUuid(sharing.itemId);
    } else if (sharing.itemType === 'folder') {
      sharedItem = await this.folderUsecases.getByUuid(sharing.itemId);
    }

    if (!sharedItem) {
      throw new NotFoundException();
    }

    const isTheOwner = sharedItem.isOwnedBy(user);

    if (!isTheOwner) {
      throw new ForbiddenException();
    }

    await this.sharingRepository.updateSharingRoleBy(
      { sharingId: sharing.id },
      dto,
    );
  }

  async removeSharingRole(
    requester: User,
    sharingRoleId: SharingRole['id'],
  ): Promise<void> {
    const sharingRole =
      await this.sharingRepository.findSharingRole(sharingRoleId);
    if (!sharingRole) {
      throw new NotFoundException('Sharing role not found');
    }

    const sharing = await this.sharingRepository.findOneSharing({
      id: sharingRole.sharingId,
    });
    if (!sharing) {
      throw new NotFoundException('Sharing not found');
    }

    let item: Item;
    if (sharing.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(sharing.itemId);
    } else if (sharing.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(sharing.itemId);
    }

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const isRequesterOwner = item.isOwnedBy(requester);

    if (isRequesterOwner && requester.uuid === sharing.sharedWith) {
      throw new ConflictException(new OwnerCannotBeRemovedWithError().message);
    }

    if (!isRequesterOwner && requester.uuid !== sharing.sharedWith) {
      throw new ForbiddenException(new InvalidPermissionsError().message);
    }

    await this.sharingRepository.deleteSharingRole(sharingRole);
  }

  async getSharedFoldersBySharedWith(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders = await this.sharingRepository.findAllSharing(
      { sharedWith: user.uuid },
      offset,
      limit,
      order,
    );
    return folders;
  }

  async getSharedFoldersByOwner(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders = await this.sharingRepository.findAllSharing(
      { ownerId: user.uuid },
      offset,
      limit,
      order,
    );
    return folders;
  }

  async getSharedFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<GetItemsReponse> {
    const foldersWithSharedInfo =
      await this.sharingRepository.findByOwnerAndSharedWithMe(
        user.uuid,
        offset,
        limit,
        order,
      );
    const folders = (await Promise.all(
      foldersWithSharedInfo.map(async (folderWithSharedInfo) => {
        const avatar = folderWithSharedInfo.folder.user.avatar;
        return {
          ...folderWithSharedInfo.folder,
          plainName:
            folderWithSharedInfo.folder.plainName ||
            this.folderUsecases.decryptFolderName(folderWithSharedInfo.folder)
              .plainName,
          sharingId: folderWithSharedInfo.id,
          encryptionKey: folderWithSharedInfo.encryptionKey,
          dateShared: folderWithSharedInfo.createdAt,
          sharedWithMe: user.uuid !== folderWithSharedInfo.folder.user.uuid,
          user: {
            ...folderWithSharedInfo.folder.user,
            avatar: avatar
              ? await this.usersUsecases.getAvatarUrl(avatar)
              : null,
          },
          credentials: {
            networkPass: folderWithSharedInfo.folder.user.userId,
            networkUser: folderWithSharedInfo.folder.user.bridgeUser,
          },
        };
      }),
    )) as FolderWithSharedInfo[];

    return {
      folders: folders,
      files: [],
      credentials: {
        networkPass: user.userId,
        networkUser: user.bridgeUser,
      },
      token: '',
      role: 'OWNER',
    };
  }

  async getSharedFiles(
    user: User,
    offset: number,
    limit: number,
    order: [keyof FileAttributes, 'ASC' | 'DESC'][],
  ): Promise<GetItemsReponse> {
    const sharedFileInfo =
      await this.sharingRepository.getUserRelatedSharedFilesInfo(
        user.uuid,
        offset,
        limit,
      );
    const filesWithUserData = await this.fileUsecases.getFilesAndUserByUuid(
      sharedFileInfo.map((sharingData) => sharingData.itemId),
      order,
    );

    const files: FileWithSharedInfo[] = (await Promise.all(
      filesWithUserData.map(async (fileInfo) => {
        const sharingInfo = sharedFileInfo.find(
          (sharingInfo) => sharingInfo.itemId === fileInfo.uuid,
        );
        const avatar = fileInfo.user?.avatar;

        return {
          ...fileInfo,
          plainName:
            fileInfo.plainName ||
            this.fileUsecases.decrypFileName(fileInfo).plainName,
          encryptionKey: sharingInfo.encryptionKey,
          dateShared: sharingInfo.createdAt,
          sharedWithMe: user.uuid !== fileInfo.user.uuid,
          user: {
            ...fileInfo.user,
            avatar: avatar
              ? await this.usersUsecases.getAvatarUrl(avatar)
              : null,
          },
          credentials: {
            networkPass: fileInfo.user.userId,
            networkUser: fileInfo.user.bridgeUser,
          },
        };
      }),
    )) as FileWithSharedInfo[];

    return {
      folders: [],
      files: files,
      credentials: {
        networkPass: user.userId,
        networkUser: user.bridgeUser,
      },
      token: '',
      role: 'OWNER',
    };
  }

  async getSharedFilesInWorkspaceByTeams(
    user: User,
    workspaceId: Workspace['id'],
    teamIds: WorkspaceTeamAttributes['id'][],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<GetItemsReponse> {
    const sharedFilesInfo =
      await this.sharingRepository.getTeamsRelatedSharedFilesInfo(
        user.uuid,
        teamIds,
        workspaceId,
        { offset: options.offset, limit: options.limit },
      );

    const filesWithUserData =
      await this.fileRepository.getFilesWithWorkspaceUser(
        sharedFilesInfo.map((sharingData) => sharingData.itemId),
      );

    const files: FileWithSharedInfo[] = (await Promise.all(
      filesWithUserData.map(async (fileInfo) => {
        const sharingInfo = sharedFilesInfo.find(
          (sharingInfo) => sharingInfo.itemId === fileInfo.uuid,
        );
        const avatar = fileInfo.user?.avatar;

        return {
          ...fileInfo,
          plainName: fileInfo.plainName,
          encryptionKey: sharingInfo.encryptionKey,
          dateShared: sharingInfo.createdAt,
          sharedWithMe: user.uuid !== fileInfo.user.uuid,
          user: {
            ...fileInfo.user,
            avatar: avatar
              ? await this.usersUsecases.getAvatarUrl(avatar)
              : null,
          },
        };
      }),
    )) as FileWithSharedInfo[];

    return {
      folders: [],
      files: files,
      credentials: {
        networkPass: user.userId,
        networkUser: user.bridgeUser,
      },
      token: '',
      role: 'OWNER',
    };
  }

  async getSharedFoldersInWorkspaceByTeams(
    user: User,
    workspaceId: Workspace['id'],
    teamIds: WorkspaceTeamAttributes['id'][],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<GetItemsReponse> {
    const foldersWithSharedInfo =
      await this.sharingRepository.findFoldersSharedInWorkspaceByOwnerAndTeams(
        user.uuid,
        workspaceId,
        teamIds,
        options,
      );

    const folders = (await Promise.all(
      foldersWithSharedInfo.map(async (folderWithSharedInfo) => {
        const avatar = folderWithSharedInfo.folder?.user?.avatar;
        return {
          ...folderWithSharedInfo.folder,
          plainName: folderWithSharedInfo.folder.plainName,
          sharingId: folderWithSharedInfo.id,
          encryptionKey: folderWithSharedInfo.encryptionKey,
          dateShared: folderWithSharedInfo.createdAt,
          sharedWithMe: user.uuid !== folderWithSharedInfo.folder.user.uuid,
          user: {
            ...folderWithSharedInfo.folder.user,
            avatar: avatar
              ? await this.usersUsecases.getAvatarUrl(avatar)
              : null,
          },
        };
      }),
    )) as FolderWithSharedInfo[];

    return {
      folders: folders,
      files: [],
      credentials: {
        networkPass: user.userId,
        networkUser: user.bridgeUser,
      },
      token: '',
      role: 'OWNER',
    };
  }

  async findSharingsWithRolesByItem(item: File | Folder) {
    return this.sharingRepository.findSharingsWithRolesByItem(item);
  }

  async getItemSharedWith(
    user: User,
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
  ): Promise<SharingInfo[]> {
    let item: Item;

    if (itemType === 'file') {
      item = await this.fileUsecases.getByUuid(itemId);
    } else if (itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(itemId);
    } else {
      throw new BadRequestException('Wrong item type');
    }

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const sharingsWithRoles = await this.findSharingsWithRolesByItem(item);

    if (sharingsWithRoles.length === 0) {
      throw new BadRequestException('This item is not being shared');
    }

    const sharedsWith = sharingsWithRoles.map((s) => s.sharedWith);

    const isTheOwner = item.isOwnedBy(user);
    const isAnInvitedUser = sharedsWith.includes(user.uuid);

    if (!isTheOwner && !isAnInvitedUser) {
      throw new ForbiddenException();
    }

    const users = await this.usersUsecases.findByUuids(sharedsWith);

    const usersWithRoles: SharingInfo[] = await Promise.all(
      sharingsWithRoles.map(async (sharingWithRole) => {
        const user = users.find(
          (user) => user.uuid === sharingWithRole.sharedWith,
        );
        return {
          ...user,
          sharingId: sharingWithRole.id,
          avatar: user.avatar
            ? await this.usersUsecases.getAvatarUrl(user.avatar)
            : null,
          role: sharingWithRole.role,
        };
      }),
    );

    const [{ ownerId }] = sharingsWithRoles;

    const { name, lastname, email, avatar, uuid } =
      ownerId === user.uuid ? user : await this.usersUsecases.getUser(ownerId);

    const ownerWithRole: SharingInfo = {
      name,
      lastname,
      email,
      sharingId: null,
      avatar: avatar ? await this.usersUsecases.getAvatarUrl(avatar) : null,
      uuid,
      role: {
        id: 'NONE',
        name: 'OWNER',
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      },
    };

    usersWithRoles.push(ownerWithRole);

    return usersWithRoles;
  }

  async getSharedWithByItemId(
    user: User,
    itemId: Sharing['itemId'],
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<SharingInfo[]> {
    const item = await this.folderUsecases.getByUuid(itemId);

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const sharingsWithRoles =
      await this.sharingRepository.findSharingsWithRolesByItem(item);

    if (sharingsWithRoles.length === 0) {
      throw new BadRequestException('This item is not being shared');
    }

    const sharedsWith = sharingsWithRoles.map((s) => s.sharedWith);

    const isTheOwner = item.isOwnedBy(user);
    const isAnInvitedUser = sharedsWith.includes(user.uuid);

    if (!isTheOwner && !isAnInvitedUser) {
      throw new ForbiddenException();
    }

    const users = await this.usersUsecases.findByUuids(sharedsWith);
    const usersWithAvatars = await Promise.all(
      users.map(async (user) => {
        const avatar = user.avatar
          ? await this.usersUsecases.getAvatarUrl(user.avatar)
          : null;
        return {
          ...user,
          avatar,
        };
      }),
    );

    const usersWithRoles: SharingInfo[] = sharingsWithRoles.map(
      (sharingWithRole) => {
        const user = usersWithAvatars.find(
          (user) => user.uuid === sharingWithRole.sharedWith,
        );
        return {
          ...user,
          sharingId: sharingWithRole.id,
          role: sharingWithRole.role,
        };
      },
    );

    const [{ ownerId }] = sharingsWithRoles;

    const { name, lastname, email, avatar, uuid } =
      ownerId === user.uuid ? user : await this.usersUsecases.getUser(ownerId);

    const ownerWithRole: SharingInfo = {
      name,
      lastname,
      email,
      sharingId: null,
      avatar: avatar ? await this.usersUsecases.getAvatarUrl(avatar) : null,
      uuid,
      role: {
        id: 'NONE',
        name: 'OWNER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    usersWithRoles.push(ownerWithRole);

    return usersWithRoles;
  }

  async removeSharedWith(
    itemId: SharingAttributes['itemId'],
    itemType: SharingAttributes['itemType'],
    sharedWithUuid: SharingAttributes['sharedWith'],
    requester: User,
  ): Promise<void> {
    const sharing = await this.sharingRepository.findOneSharing({
      itemId,
      itemType,
      sharedWith: sharedWithUuid,
    });

    if (!sharing) {
      throw new ConflictException(
        'This item is not shared with the given user',
      );
    }

    let item: File | Folder;
    if (sharing.itemType === 'file') {
      item = await this.fileUsecases.getByUuid(sharing.itemId);
    } else if (sharing.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(sharing.itemId);
    }

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.isOwnedBy(requester) && !sharing.isSharedWith(requester)) {
      throw new InvalidPermissionsError();
    }

    const sharingRole = await this.sharingRepository.findSharingRoleBy({
      sharingId: sharing.id,
    });
    if (!sharingRole) {
      throw new NotFoundException('Sharing role not found');
    }

    await this.sharingRepository.deleteSharingRole(sharingRole);
    await this.sharingRepository.deleteSharing(sharing.id);
  }

  async notifyUserRemovedFromSharing(
    sharing: Sharing,
    item: Item,
  ): Promise<void> {
    const user = await this.usersUsecases.getUser(sharing.sharedWith);

    if (user) {
      new MailerService(this.configService)
        .sendRemovedFromSharingEmail(user.email, item.plainName)
        .catch(() => {
          // no op
        });
    }
  }

  async canPerfomAction(
    sharedWith: Sharing['sharedWith'] | Sharing['sharedWith'][],
    resourceId: Sharing['itemId'],
    action: SharingActionName,
    sharedWithType = SharedWithType.Individual,
  ) {
    const permissions = await this.sharingRepository.findPermissionsInSharing(
      sharedWith,
      sharedWithType,
      resourceId,
    );

    return permissions.some((p) => p.name === action);
  }

  async notifyUserSharingRoleUpdated(
    sharing: Sharing,
    item: Item,
    newRole: Role,
  ): Promise<void> {
    const user = await this.usersUsecases.getUser(sharing.sharedWith);

    if (user) {
      new MailerService(this.configService)
        .sendUpdatedSharingRoleEmail(user.email, item.plainName, newRole.name)
        .catch(() => {
          // no op
        });
    }
  }

  async validateInvite(inviteId: string): Promise<{ uuid: string }> {
    if (!validateUuid(inviteId)) {
      throw new BadRequestException('id is not in uuid format');
    }
    const sharingInvite = await this.sharingRepository.getInviteById(inviteId);

    if (!sharingInvite?.expirationAt) {
      throw new BadRequestException(
        'We were not able to validate this invitation',
      );
    }
    const now = new Date();

    if (now > sharingInvite.expirationAt) {
      await this.sharingRepository.deleteInvite(sharingInvite);
      throw new NotFoundException('Invitation expired');
    }

    return {
      uuid: inviteId,
    };
  }

  async changeSharingType(
    user: User,
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    type: Sharing['type'],
  ): Promise<void> {
    let item: File | Folder;

    if (itemType === 'file') {
      item = await this.fileUsecases.getByUuid(itemId);
    } else if (itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(itemId);
    }
    const isUserOwner = item.isOwnedBy(user);

    if (!isUserOwner) {
      throw new ForbiddenException();
    }

    const changeSharingToPrivate = type === SharingType.Private;

    if (changeSharingToPrivate) {
      await this.sharingRepository.deleteSharingsBy({
        itemId,
        itemType,
        type: SharingType.Public,
        ownerId: user.uuid,
        sharedWithType: SharedWithType.Individual,
      });
    }
  }

  async getSharingType(
    user: User,
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    sharedWithType = SharedWithType.Individual,
  ): Promise<Sharing> {
    const [publicSharing, privateSharing] = await Promise.all([
      this.sharingRepository.findOneByOwnerOrSharedWithItem(
        '00000000-0000-0000-0000-000000000000',
        itemId,
        itemType,
        SharingType.Public,
        sharedWithType,
      ),
      this.sharingRepository.findOneByOwnerOrSharedWithItem(
        user.uuid,
        itemId,
        itemType,
        SharingType.Private,
        sharedWithType,
      ),
    ]);

    const sharedItem = publicSharing || privateSharing;

    if (!sharedItem) {
      throw new NotFoundException('Item is not being shared');
    }

    return sharedItem;
  }

  async getItemSharingInfo(
    user: User,
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    sharedWithType = SharedWithType.Individual,
  ): Promise<ItemSharingInfoDto> {
    const [publicSharing, privateSharing] = await Promise.all([
      this.sharingRepository.findOneByOwnerOrSharedWithItem(
        '00000000-0000-0000-0000-000000000000',
        itemId,
        itemType,
        SharingType.Public,
        sharedWithType,
      ),
      this.sharingRepository.findOneByOwnerOrSharedWithItem(
        user.uuid,
        itemId,
        itemType,
        SharingType.Private,
        sharedWithType,
      ),
    ]);

    const invitationsCount =
      await this.sharingRepository.getInvitesNumberByItem(itemId, itemType);

    const sharedItem = publicSharing || privateSharing;

    if (!sharedItem && invitationsCount === 0) {
      throw new NotFoundException('Item is not being shared');
    }

    return {
      publicSharing: publicSharing
        ? {
            id: publicSharing?.id,
            isPasswordProtected: !!publicSharing?.encryptedPassword,
            encryptedCode: publicSharing?.encryptedCode,
          }
        : null,
      type: sharedItem?.type || SharingType.Private,
      invitationsCount,
    };
  }

  async getPublicSharingFolderSize(
    id: SharingAttributes['id'],
  ): Promise<number> {
    const sharing = await this.sharingRepository.findOneSharing({
      id,
      type: SharingType.Public,
      itemType: 'folder',
    });

    if (!sharing) {
      throw new SharingNotFoundException();
    }

    return this.folderUsecases.getFolderSizeByUuid(sharing.itemId, false);
  }

  async createSharing(
    sharing: Sharing,
    roleId: SharingRole['roleId'],
  ): Promise<Sharing> {
    const createdSharing = await this.sharingRepository.createSharing(sharing);

    await this.sharingRepository.createSharingRole({
      roleId,
      sharingId: createdSharing.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return createdSharing;
  }
}
