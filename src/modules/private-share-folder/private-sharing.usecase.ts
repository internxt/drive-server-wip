import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
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

export class OwnerCannotBeSharedError extends Error {
  constructor() {
    super('Owner cannot be shared');
    Object.setPrototypeOf(this, OwnerCannotBeSharedError.prototype);
  }
}

@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private folderUsecase: FolderUseCases,
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

    const folder = await this.folderUsecase.getFolderByUuid(
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

  async createPrivateSharingFolder(
    owner: User,
    folderId: Folder['uuid'],
    invatedUserEmail: User['email'],
    encryptionKey: PrivateSharingFolder['encryptionKey'],
  ) {
    const sharedWith = await this.userUsecase.getUserByUsername(
      invatedUserEmail,
    );

    if (!sharedWith) {
      throw new InvitedUserNotFoundError(invatedUserEmail);
    }

    // owner should not be invited to his own folder
    if (owner.id === sharedWith.id) {
      throw new OwnerCannotBeSharedError();
    }

    const folder = await this.folderUsecase.getFolderByUuid(folderId);

    if (folder.userId !== owner.id) {
      throw new InvalidOwnerError();
    }

    // if a user has a role could not be invited again
    const sharedWithFound =
      await this.privateSharingRespository.findPrivateFolderRoleByFolderIdAndUserId(
        sharedWith.uuid,
        folderId,
      );

    if (sharedWithFound) {
      throw new UserAlreadyHasRole();
    }

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
}
