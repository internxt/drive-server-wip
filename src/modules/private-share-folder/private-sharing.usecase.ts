import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';

export class InvalidOwnerError extends Error {
  constructor() {
    super('You are not the owner of this folder');
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
