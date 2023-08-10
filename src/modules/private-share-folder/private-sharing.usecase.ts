import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';

export class InvalidOwnerError extends Error {
  constructor() {
    super('You are not the owner of this folder');
  }
}

export class InvalidSharedFolderError extends Error {
  constructor() {
    super('This is not a shared folder');
    Object.setPrototypeOf(this, InvalidSharedFolderError.prototype);
  }
}

export class UserNotInvitedError extends Error {
  constructor() {
    super('User not invited');
    Object.setPrototypeOf(this, UserNotInvitedError.prototype);
  }
}

@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private userRespository: SequelizeUserRepository,
    private folderRespository: SequelizeFolderRepository,
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

  async getSharedWithByFolderId(
    user: User,
    folderId: Folder['uuid'],
    offset: number,
    limit: number,
    order: [string, string][],
  ) {
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

    if (users.length === 0) {
      throw new InvalidSharedFolderError();
    }

    const userIsInvited = users.some(
      (invitedUser) => invitedUser.uuid === user.uuid,
    );

    if (!userIsInvited) {
      throw new UserNotInvitedError();
    }

    return users;
  }
}
