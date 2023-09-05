import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { v4 } from 'uuid';

import {
  Role,
  Sharing,
  SharingAttributes,
  SharingInvite,
  SharingInviteWithItemAndUser,
  SharingRole,
} from './sharing.domain';
import { User } from '../user/user.domain';
import { CreateInviteDto } from './dto/create-invite.dto';
import { SequelizeSharingRepository } from './sharing.repository';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { File, FileStatus } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { UserNotFoundError, UserUseCases } from '../user/user.usecase';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import getEnv from '../../config/configuration';
import {
  generateTokenWithPlainSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import {
  FileWithSharedInfo,
  FolderWithSharedInfo,
  GetFilesResponse,
  GetFoldersReponse,
  GetItemsReponse,
} from './dto/get-items-and-shared-folders.dto';
import { GetInviteDto, GetInvitesDto } from './dto/get-invites.dto';

export class InvalidOwnerError extends Error {
  constructor() {
    super('You are not the owner of this folder');
    Object.setPrototypeOf(this, InvalidOwnerError.prototype);
  }
}

export class FolderNotSharedError extends Error {
  constructor() {
    super('This folder is not shared');
    Object.setPrototypeOf(this, FolderNotSharedError.prototype);
  }
}

export class ItemNotSharedWithUserError extends Error {
  constructor() {
    super(`This item is not shared with the given user`);
    Object.setPrototypeOf(this, ItemNotSharedWithUserError.prototype);
  }
}

export class UserNotInSharedFolder extends Error {
  constructor() {
    super('User is not in shared folder');
    Object.setPrototypeOf(this, UserNotInSharedFolder.prototype);
  }
}

export class RoleNotFoundError extends Error {
  constructor() {
    super('Role not found');
    Object.setPrototypeOf(this, RoleNotFoundError.prototype);
  }
}

export class InvalidPrivateFolderRoleError extends Error {
  constructor() {
    super('Private folder role not found');
    Object.setPrototypeOf(this, InvalidPrivateFolderRoleError.prototype);
  }
}

export class InvalidChildFolderError extends Error {
  constructor() {
    super('Folder not found');
    Object.setPrototypeOf(this, InvalidChildFolderError.prototype);
  }
}

export class UserNotInvitedError extends Error {
  constructor() {
    super('User not invited');
    Object.setPrototypeOf(this, UserNotInvitedError.prototype);
  }
}

export class InvitedUserNotFoundError extends Error {
  constructor(email: User['email']) {
    super(`Invited user: ${email} not found`);
    Object.setPrototypeOf(this, InvitedUserNotFoundError.prototype);
  }
}

export class UserAlreadyHasRole extends BadRequestException {
  constructor() {
    super('User already has a role');
    Object.setPrototypeOf(this, UserAlreadyHasRole.prototype);
  }
}

export class OwnerCannotBeSharedWithError extends BadRequestException {
  constructor() {
    super('Owner cannot share the folder with itself');
    Object.setPrototypeOf(this, OwnerCannotBeSharedWithError.prototype);
  }
}

export class OwnerCannotBeRemovedWithError extends Error {
  constructor() {
    super('Owner cannot be removed from the item sharing');
    Object.setPrototypeOf(this, OwnerCannotBeRemovedWithError.prototype);
  }
}

export class InvalidSharedFolderError extends Error {
  constructor() {
    super('This folder is not being shared');
    Object.setPrototypeOf(this, InvalidSharedFolderError.prototype);
  }
}

export class InvalidPermissionsError extends ForbiddenException {
  constructor() {
    super('You dont have permissions on this item');
    Object.setPrototypeOf(this, InvalidPermissionsError.prototype);
  }
}

export class SharedFolderInTheTrashError extends Error {
  constructor() {
    super('This folder is in the trash');
    Object.setPrototypeOf(this, SharedFolderInTheTrashError.prototype);
  }
}

export class SharedFolderRemovedError extends Error {
  constructor() {
    super('This folder has been removed');
    Object.setPrototypeOf(this, SharedFolderRemovedError.prototype);
  }
}

type SharingInfo = Pick<
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

@Injectable()
export class SharingService {
  constructor(
    private readonly sharingRepository: SequelizeSharingRepository,
    private readonly fileUsecases: FileUseCases,
    private readonly folderUsecases: FolderUseCases,
    private readonly usersUsecases: UserUseCases,
  ) {}

  async getInvites(
    user: User,
    itemType: Sharing['itemType'],
    itemId: Sharing['itemId'],
  ): Promise<GetInvitesDto> {
    let item: File | Folder | null;

    if (itemType === 'file') {
      throw new NotImplementedException();
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
    const invites = await this.sharingRepository.getInvites(
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
            avatar: await this.usersUsecases.getAvatarUrl(
              invite.invited.avatar,
            ),
          },
          item,
        };
      }),
    );
  }

  async getFolders(
    folderId: Folder['uuid'],
    token: string | null,
    user: User,
    page: number,
    perPage: number,
    order: [string, string][],
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

    if (folder.isOwnedBy(user)) {
      return {
        items: await getFolderContent(user.id, folder.id),
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
      };
    }

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
      sharedWith: user.uuid,
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
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

    return {
      items: await getFolderContent(owner.id, folder.id),
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
    };
  }

  async getFiles(
    folderId: Folder['uuid'],
    token: string | null,
    user: User,
    page: number,
    perPage: number,
    order: [string, string][],
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

    if (folder.isOwnedBy(user)) {
      return {
        items: await getFilesFromFolder(user.id, folder.id),
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
      };
    }

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
      sharedWith: user.uuid,
      itemId: requestedFolderIsSharedRootFolder
        ? folderId
        : decoded.sharedRootFolderId,
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

    return {
      items: await getFilesFromFolder(owner.id, folder.id),
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

    const userJoining = await this.usersUsecases.findByEmail(
      createInviteDto.sharedWith,
    );

    if (!userJoining) {
      throw new NotFoundException('Invited user not found');
    }

    if (isAnInvitation) {
      if (createInviteDto.itemType === 'file') {
        throw new NotImplementedException();
      }

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
        }),
      ]);

      const userAlreadyInvited = invitation !== null;
      const userAlreadyJoined = sharing !== null;

      if (userAlreadyInvited || userAlreadyJoined) {
        throw new UserAlreadyHasRole();
      }

      const item = await this.folderUsecases.getByUuid(createInviteDto.itemId);
      const resourceIsOwnedByUser = item.isOwnedBy(user);

      if (!resourceIsOwnedByUser) {
        throw new ForbiddenException();
      }

      const invite = SharingInvite.build({
        id: v4(),
        ...createInviteDto,
        sharedWith: userJoining.uuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      delete invite['id'];

      return this.sharingRepository.createInvite(invite);
    } else {
      throw new NotImplementedException();
    }
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

    const item = await this.folderUsecases.getByUuid(invite.itemId);
    const owner = await this.usersUsecases.findById(item.userId);

    if (!owner) {
      throw new NotFoundException('Owner of this resource not found');
    }

    const newSharing = Sharing.build({
      ...invite,
      id: v4(),
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

    const item = await this.folderUsecases.getByUuid(invite.itemId);

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
      throw new NotFoundException();
    }

    if (!sharing.isOwnedBy(user)) {
      throw new ForbiddenException();
    }

    await this.sharingRepository.deleteInvitesBy({
      itemId,
      itemType,
    });
    await this.sharingRepository.deleteSharingRolesBySharing(sharing);
    return this.sharingRepository.deleteSharing(sharing.id);
  }

  async getRoles(): Promise<Role[]> {
    return this.sharingRepository.findRoles();
  }

  async getUserRole(sharingId: Sharing['id'], user: User): Promise<Role> {
    const sharing = await this.sharingRepository.findOneSharing({
      id: sharingId,
    });

    if (sharing.isOwnedBy(user)) {
      return Role.build({
        id: v4(),
        createdAt: sharing.createdAt,
        name: 'OWNER',
        updatedAt: sharing.updatedAt,
      });
    }

    if (!sharing) {
      throw new NotFoundException();
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

    return role;
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

    let sharedItem: File | Folder;

    if (sharing.itemType === 'file') {
      throw new Error('Not implemented yet');
    } else if (sharing.itemType === 'folder') {
      sharedItem = await this.folderUsecases.getByUuid(sharing.itemId);
    }

    if (!sharedItem) {
      throw new NotFoundException();
    }

    const isTheUserAuthorizedToUpdateTheRole = sharedItem.isOwnedBy(user);

    if (!isTheUserAuthorizedToUpdateTheRole) {
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
    const sharingRole = await this.sharingRepository.findSharingRole(
      sharingRoleId,
    );
    if (!sharingRole) {
      throw new NotFoundException('Sharing role not found');
    }

    const sharing = await this.sharingRepository.findOneSharing({
      id: sharingRole.sharingId,
    });
    if (!sharing) {
      throw new NotFoundException('Sharing not found');
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
    const folders = foldersWithSharedInfo.map((folderWithSharedInfo) => {
      return {
        ...folderWithSharedInfo.folder,
        sharingId: folderWithSharedInfo.id,
        encryptionKey: folderWithSharedInfo.encryptionKey,
        dateShared: folderWithSharedInfo.createdAt,
        sharedWithMe: user.uuid !== folderWithSharedInfo.folder.user.uuid,
        credentials: {
          networkPass: folderWithSharedInfo.folder.user.userId,
          networkUser: folderWithSharedInfo.folder.user.bridgeUser,
        },
      };
    }) as FolderWithSharedInfo[];

    return {
      folders: folders,
      files: [],
      credentials: {
        networkPass: user.userId,
        networkUser: user.bridgeUser,
      },
      token: '',
    };
  }

  async getSharedWithByItemId(
    user: User,
    folderId: Folder['uuid'],
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<SharingInfo[]> {
    const privateSharings =
      await this.sharingRepository.findByOwnerOrSharedWithFolderId(
        user.uuid,
        folderId,
        offset,
        limit,
        order,
      );

    if (privateSharings.length === 0) {
      throw new ForbiddenException();
    }

    const sharedsWith = privateSharings.map((privateSharing) => {
      return privateSharing.sharedWith;
    });

    const users = await this.usersUsecases.findByUuids(sharedsWith);

    const sharingsWithRoles =
      await this.sharingRepository.findSharingsWithRolesBySharedWith(users);

    const usersWithRoles: SharingInfo[] = await Promise.all(
      users.map(async (user) => {
        const sharing = sharingsWithRoles.find(
          (sharing) => sharing.sharedWith === user.uuid,
        );
        const avatar = await this.usersUsecases.getAvatarUrl(user.avatar);
        return {
          ...user,
          sharingId: sharing.id,
          avatar,
          role: sharing.role,
        };
      }),
    );

    const [{ ownerId }] = privateSharings;

    const { name, lastname, email, avatar, uuid } =
      ownerId === user.uuid ? user : await this.usersUsecases.getUser(ownerId);

    const ownerWithRole: SharingInfo = {
      name,
      lastname,
      email,
      sharingId: null,
      avatar: await this.usersUsecases.getAvatarUrl(avatar),
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
      throw new ConflictException(new ItemNotSharedWithUserError().message);
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
}
