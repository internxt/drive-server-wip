import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { UserNotFoundError } from '../user/user.usecase';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

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

    Object.setPrototypeOf(this, InvalidOwnerError.prototype);
  }
}

export class UserNotInvitedError extends Error {
  constructor() {
    super('User not invited');
    Object.setPrototypeOf(this, UserNotInvitedError.prototype);
  }
}

export class FolderNotSharedError extends Error {
  constructor() {
    super('This folder is not shared');
    Object.setPrototypeOf(this, FolderNotSharedError.prototype);
  }
}
export class UserNotInSharedFolder extends Error {
  constructor() {
    super('User is not in shared folder');
    Object.setPrototypeOf(this, UserNotInSharedFolder.prototype);
  }
}
@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private userRepository: SequelizeUserRepository,
    private folderRespository: SequelizeFolderRepository,
    private privateSharingFolderRolesRespository: PrivateSharingFolderRolesRepository,
  ) {}
  async grantPrivileges(
    owner: User,
    userUuid: User['uuid'],
    privateFolderId: PrivateSharingFolder['id'],
    roleUuid: PrivateSharingRole['id'],
  ) {
    const privateFolder = await this.privateSharingRespository.findById(
      privateFolderId,
    );

    const folder = privateFolder.folder;

    if (owner.id !== folder.userId) {
      throw new InvalidOwnerError();
    }

    await this.privateSharingRespository.createPrivateFolderRole(
      userUuid,
      folder.uuid,
      roleUuid,
    );
  }

  async updateRole(
    owner: User,
    invatedUserEmail: User['email'],
    folderId: Folder['uuid'],
    roleId: PrivateSharingRole['id'],
  ) {
    const sharedWith = await this.userRepository.findByUsername(
      invatedUserEmail,
    );

    const privateFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleByUserIdAndFolderId(
        sharedWith.uuid,
        folderId,
      );

    if (!privateFolderRole) {
      throw new UserNotInvitedError();
    }

    const folder = await this.folderRespository.findByUuid(
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
      privateFolderRole,
      roleId,
    );

    return {
      message: 'Role updated',
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
    invatedUserEmail: User['email'],
    encryptionKey: PrivateSharingFolder['encryptionKey'],
  ) {
    const folder = await this.folderRespository.findByUuid(folderId);

    const sharedWith = await this.userRepository.findByUsername(
      invatedUserEmail,
    );

    if (!sharedWith) {
      new UserNotFoundError();
    }

    if (folder.userId !== owner.id) {
      throw new InvalidOwnerError();
    }

    // TODO: validate if user has a role with share permissions over the folder
    // it must be included when the permissions are defined

    const privateFolder =
      await this.privateSharingRespository.createPrivateFolder(
        folderId,
        owner.uuid,
        sharedWith.uuid,
        encryptionKey,
      );

    return privateFolder;
  }

  async getAllRoles(): Promise<PrivateSharingRole[]> {
    const roles = await this.privateSharingRespository.getAllRoles();

    return roles;
  }

  async getSharedWithByFolderId(
    user: User,
    folderId: Folder['uuid'],
    offset: number,
    limit: number,
    order: [string, string][],
  ) {
    const privateSharingFolder =
      await this.privateSharingRespository.findByFolderIdAndOwnerId(
        folderId,
        user.uuid,
      );

    if (!privateSharingFolder) {
      throw new Error('Folder not found');
    }

    const parentFolders = await this.folderRespository.findAllParentsUuid(
      folderId,
    );

    const parentFoldersIds = parentFolders.map((folder) => folder.uuid);

    const users =
      await this.privateSharingRespository.findSharedUsersByFolderUuids(
        parentFoldersIds,
        offset,
        limit,
        order,
      );

    return users;
  }

  async getPrivateSharedFolderByFolderId(
    user: User,
    folderId: Folder['uuid'],
  ): Promise<PrivateSharingFolder> {
    const privateFolder =
      await this.privateSharingRespository.findByFolderIdAndOwnerId(
        folderId,
        user.uuid,
      );
    return privateFolder;
  }

  async stopSharing(folderUuid: Folder['uuid']): Promise<any> {
    await this.validateFolderShared(folderUuid);
    const folderRolesRemoved =
      await this.privateSharingFolderRolesRespository.removeByFolder(
        folderUuid,
      );
    const sharingRemoved =
      await this.privateSharingRespository.removeByFolderUuid(folderUuid);
    const stoped = folderRolesRemoved + sharingRemoved > 0;
    return { stoped };
  }

  private async validateFolderShared(folderUuid: Folder['uuid']) {
    const folderRolesByFolder =
      await this.privateSharingFolderRolesRespository.findByFolder(folderUuid);
    const sharingByFolder = await this.privateSharingRespository.findByFolder(
      folderUuid,
    );
    if (folderRolesByFolder.length === 0 && sharingByFolder.length === 0) {
      throw new FolderNotSharedError();
    }
  }

  async removeUserShared(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<any> {
    await this.ValidateUserInFolderShared(folderUuid, userUuid);
    const folderRolesRemoved =
      await this.privateSharingFolderRolesRespository.removeByUser(
        folderUuid,
        userUuid,
      );
    const userSharedRemoved =
      await this.privateSharingRespository.removeBySharedWith(
        folderUuid,
        userUuid,
      );
    const removed = folderRolesRemoved + userSharedRemoved > 0;
    return { removed };
  }

  private async ValidateUserInFolderShared(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ) {
    const folderRolesByFolderAndUser =
      await this.privateSharingFolderRolesRespository.findByFolderAndUser(
        folderUuid,
        userUuid,
      );
    const sharingByFolderAndSharedWith =
      await this.privateSharingRespository.findByFolderAndSharedWith(
        folderUuid,
        userUuid,
      );
    if (
      folderRolesByFolderAndUser.length === 0 &&
      sharingByFolderAndSharedWith.length === 0
    ) {
      throw new UserNotInSharedFolder();
    }
  }
}
