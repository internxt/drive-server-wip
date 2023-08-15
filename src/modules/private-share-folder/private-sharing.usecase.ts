import { ForbiddenException, Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileStatus } from '../file/file.domain';
import {
  generateTokenWithPlainSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import getEnv from '../../config/configuration';
import {
  FolderWithSharedInfo,
  GetItemsReponse,
} from './dto/get-items-and-shared-folders.dto';
export class InvalidOwnerError extends Error {
  constructor() {
    super('You are not the owner of this folder');
    Object.setPrototypeOf(this, InvalidOwnerError.prototype);
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
  constructor(email: string) {
    super(`Invited user: ${email} not found`);
    Object.setPrototypeOf(this, UserNotInvitedError.prototype);
  }
}

export class UserAlreadyHasRole extends Error {
  constructor() {
    super('User already has a role');
    Object.setPrototypeOf(this, UserAlreadyHasRole.prototype);
  }
}

export class OwnerCannotBeSharedWithError extends Error {
  constructor() {
    super('Owner cannot share the folder with itself');
    Object.setPrototypeOf(this, OwnerCannotBeSharedWithError.prototype);
  }
}

@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private folderUsecase: FolderUseCases,
    private fileUsecase: FileUseCases,
    private userUsecase: UserUseCases,
  ) {}
  async grantPrivileges(
    owner: User,
    invitedUser: User['uuid'],
    privateFolderId: PrivateSharingFolder['id'],
    roleUuid: PrivateSharingRole['id'],
  ) {
    const privateFolderSharing = await this.privateSharingRespository.findById(
      privateFolderId,
    );

    if (owner.uuid !== privateFolderSharing.ownerId) {
      throw new ForbiddenException();
    }

    await this.privateSharingRespository.createPrivateFolderRole(
      invitedUser,
      privateFolderSharing.folder.uuid,
      roleUuid,
    );
  }

  async updateRole(
    owner: User,
    userOwningTheRole: User['uuid'],
    folderId: Folder['uuid'],
    roleId: PrivateSharingRole['id'],
  ) {
    const sharedWith = await this.userUsecase.getUser(userOwningTheRole);

    const privateFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderIdAndUserId(
        sharedWith.uuid,
        folderId,
      );

    if (!privateFolderRole) {
      throw new UserNotInvitedError();
    }

    const folder = await this.folderUsecase.getByUuid(
      privateFolderRole.folderId,
    );

    if (owner.id !== folder.userId) {
      throw new InvalidOwnerError();
    }

    const role = await this.privateSharingRespository.findRoleById(roleId);

    if (!role) {
      throw new RoleNotFoundError();
    }

    await this.privateSharingRespository.updatePrivateFolderRole(
      privateFolderRole.id,
      roleId,
    );

    return {
      message: 'Role updated',
    };
  }

  // folders shared with me and folders shared by me
  async getSharedFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<GetItemsReponse> {
    const foldersWithSharedInfo =
      await this.privateSharingRespository.findByOwnerAndSharedWithMe(
        user.uuid,
        offset,
        limit,
        order,
      );
    const folders = foldersWithSharedInfo.map((folderWithSharedInfo) => {
      return {
        ...folderWithSharedInfo.folder,
        encryptionKey: folderWithSharedInfo.encryptionKey,
        dateShared: folderWithSharedInfo.createdAt,
        sharedWithMe: user.uuid !== folderWithSharedInfo.folder.user.uuid,
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

  async getSharedFoldersByOwner(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders = await this.privateSharingRespository.findByOwner(
      user.uuid,
      offset,
      limit,
      order,
    );
    return folders;
  }

  async getSharedFoldersBySharedWith(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders = await this.privateSharingRespository.findBySharedWith(
      user.uuid,
      offset,
      limit,
      order,
    );
    return folders;
  }

  async createPrivateSharingFolder(
    owner: User,
    folderId: Folder['uuid'],
    invitedUserEmail: User['email'],
    encryptionKey: PrivateSharingFolder['encryptionKey'],
    roleId: PrivateSharingRole['id'],
  ): Promise<void> {
    const sharedWith = await this.userUsecase.getUserByUsername(
      invitedUserEmail,
    );

    if (!sharedWith) {
      throw new InvitedUserNotFoundError(invitedUserEmail);
    }

    if (owner.id === sharedWith.id) {
      throw new OwnerCannotBeSharedWithError();
    }

    const folder = await this.folderUsecase.getByUuid(folderId);

    if (folder.userId !== owner.id) {
      throw new ForbiddenException('You are not the owner of this folder');
    }

    const sharedWithMaybeExistentRole =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderIdAndUserId(
        sharedWith.uuid,
        folderId,
      );

    const invitedUserAlreadyHasARole = !!sharedWithMaybeExistentRole;

    if (invitedUserAlreadyHasARole) {
      throw new UserAlreadyHasRole();
    }

    const privateFolder =
      await this.privateSharingRespository.createPrivateFolder(
        folderId,
        owner.uuid,
        sharedWith.uuid,
        encryptionKey,
      );

    await this.privateSharingRespository.createPrivateFolderRole(
      privateFolder.sharedWith,
      folder.uuid,
      roleId,
    );
  }

  getAllRoles(): Promise<PrivateSharingRole[]> {
    return this.privateSharingRespository.getAllRoles();
  }

  async getItems(
    folderId: Folder['uuid'],
    token: string | null,
    user: User,
    page: number,
    perPage: number,
    order: [string, string][],
  ): Promise<GetItemsReponse> {
    const getFolderContent = async (
      userId: User['id'],
      folderId: Folder['id'],
    ) => {
      const folders = (
        await this.folderUsecase.getFolders(
          userId,
          {
            parentId: folderId,
            deleted: false,
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

      return {
        folders,
        files: await this.fileUsecase.getFiles(
          userId,
          {
            folderId: folderId,
            status: FileStatus.EXISTS,
          },
          {
            limit: perPage,
            offset: page * perPage,
          },
        ),
      };
    };
    const folder = await this.folderUsecase.getByUuid(folderId);
    const parentFolder = folder.parentId
      ? await this.folderUsecase.getFolder(folder.parentId)
      : null;

    if (folder.isOwnedBy(user)) {
      return {
        ...(await getFolderContent(user.id, folder.id)),
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
              sharedRootFolderId: PrivateSharingFolder['id'];
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

    const userRole =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderIdAndUserId(
        user.uuid,
        requestedFolderIsSharedRootFolder
          ? folderId
          : decoded.sharedRootFolderId,
      );

    if (!userRole) {
      throw new ForbiddenException('User does not have access to this folder');
    }

    const privateSharingFolder =
      await this.privateSharingRespository.findPrivateFolderByFolderIdAndSharedWith(
        requestedFolderIsSharedRootFolder
          ? folderId
          : decoded.sharedRootFolderId,
        user.uuid,
      );

    const owner = await this.userUsecase.getUser(privateSharingFolder.ownerId);

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
      ...(await getFolderContent(owner.id, folder.id)),
      credentials: {
        networkPass: owner.userId,
        networkUser: owner.bridgeUser,
      },
      token: generateTokenWithPlainSecret(
        {
          sharedRootFolderId: privateSharingFolder.folderId,
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
}
