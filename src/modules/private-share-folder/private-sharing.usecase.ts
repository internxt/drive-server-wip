import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { SequelizeFileRepository } from '../file/file.repository';
import { OrderBy } from 'src/common/order.type';

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
@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private userRespository: SequelizeUserRepository,
    private folderRespository: SequelizeFolderRepository,
    private fileRespository: SequelizeFileRepository,
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
    privateFolderRoleId: PrivateSharingFolder['id'],
    roleId: PrivateSharingRole['id'],
  ) {
    const privateFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleById(
        privateFolderRoleId,
      );

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

  async getItems(
    parentPrivateSharingFolderId: PrivateSharingFolder['id'],
    folderId: Folder['id'],
    user: User,
    page: number,
    perPage: number,
    order: [string, string][],
  ) {
    // Check if user has access to the parent private folder
    const privateSharingFolder = await this.privateSharingRespository.findById(
      parentPrivateSharingFolderId,
    );

    const owner = await this.userRespository.findByUuid(
      privateSharingFolder.ownerId,
    );

    const parentFolderUuid = privateSharingFolder.folderId;
    const parentFolderId = privateSharingFolder.folder.id;

    const privateSharingFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderUuidAndUserUuid(
        parentFolderUuid,
        user.uuid,
      );

    if (!privateSharingFolderRole) {
      throw new InvalidPrivateFolderRoleError();
    }

    const folder = await this.folderRespository.findById(folderId);

    // Check if folderUuid is a child of parentPrivateFolderId
    const folderFound = await this.folderRespository.findInTree(
      parentFolderId,
      folder.id,
      folder.userId,
      false,
    );

    if (!folderFound) {
      throw new InvalidChildFolderError();
    }

    // obtain items from the folder
    const folders = await this.folderRespository.findAllByParentId(
      folderId,
      false,
      page,
      perPage,
      order,
    );

    const files = await this.fileRespository.findAllByParentId(
      folderId,
      false,
      page,
      perPage,
      order,
    );

    return {
      folders,
      files,
      credentials: {
        userId: owner.userId,
        username: owner.username,
      },
    };
  }
}
