import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { FolderUseCases } from '../folder/folder.usecase';

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
    invatedUserId: User['uuid'],
    folderId: Folder['uuid'],
    roleId: PrivateSharingRole['id'],
  ) {
    const sharedWith = await this.userUsecase.getUser(invatedUserId);

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
      privateFolderRole?.id,
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
    folderId: Folder['uuid'],
    sharedFolderId: PrivateSharingFolder['id'],
    user: User,
    page: number,
    perPage: number,
    order: [string, string][],
  ) {
    const privateSharingFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderIdAndUserId(
        user.uuid,
        sharedFolderId,
      );

    if (!privateSharingFolderRole) {
      throw new InvalidPrivateFolderRoleError();
    }

    const privateSharingFolder =
      await this.privateSharingRespository.findPrivateFolderByFolderIdAndUserId(
        sharedFolderId,
        user.uuid,
      );

    const owner = await this.userUsecase.getUser(privateSharingFolder.ownerId);

    const folder = await this.folderUsecase.getByUuid(folderId);
    const parentFolder = await this.folderUsecase.getByUuid(sharedFolderId);

    const folderFound = await this.folderUsecase.isFolderInsideFolder(
      parentFolder.id,
      folder.id,
      owner.id,
    );

    if (!folderFound) {
      throw new InvalidChildFolderError();
    }

    // obtain items from the folder
    const folders = await this.folderUsecase.getFoldersByParent(
      folder.id,
      page,
      perPage,
    );

    const files = await this.fileUsecase.getAllByParentId(
      folder.id,
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
