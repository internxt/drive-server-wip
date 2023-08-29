import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { v4 } from 'uuid';

import { Role, Sharing, SharingInvite, SharingRole } from './sharing.domain';
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
export class FolderNotSharedWithUserError extends Error {
  constructor() {
    super(`This folder is not shared with the given user`);
    Object.setPrototypeOf(this, FolderNotSharedWithUserError.prototype);
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
export class OwnerCannotBeRemovedWithError extends Error {
  constructor() {
    super('Owner cannot be removed from the folder sharing');
    Object.setPrototypeOf(this, OwnerCannotBeRemovedWithError.prototype);
  }
}
export class InvalidSharedFolderError extends Error {
  constructor() {
    super('This folder is not being shared');
    Object.setPrototypeOf(this, InvalidSharedFolderError.prototype);
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
type UserWithRole = Pick<
  User,
  'name' | 'lastname' | 'uuid' | 'avatar' | 'email'
> & {
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
  ): Promise<SharingInvite[]> {
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

    return this.sharingRepository.getInvitesByItem(itemId, itemType);
  }

  async createInvite(
    user: User,
    createInviteDto: CreateInviteDto,
  ): Promise<SharingInvite> {
    const isAnInvitation = createInviteDto.type === 'OWNER';
    const isARequestToJoin = createInviteDto.type === 'SELF';

    if (!isAnInvitation && !isARequestToJoin) {
      throw new BadRequestException();
    }

    if (isAnInvitation) {
      if (createInviteDto.itemType === 'file') {
        throw new Error('Method not implemented');
      }

      const item = await this.folderUsecases.getByUuid(createInviteDto.itemId);
      const resourceIsOwnedByUser = item.isOwnedBy(user);

      if (!resourceIsOwnedByUser) {
        throw new ForbiddenException();
      }

      const invite = SharingInvite.build({
        id: v4(),
        ...createInviteDto,
      });

      delete invite['id'];

      return this.sharingRepository.createInvite(invite);
    } else {
      throw new NotImplementedException();
    }
  }

  async acceptInvite(user: User, acceptInviteDto: AcceptInviteDto) {
    const invite = await this.sharingRepository.getInviteById(
      acceptInviteDto.invitationId,
    );

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

    if (!isUserTheOwnerOfTheResource) {
      throw new ForbiddenException();
    }

    await this.sharingRepository.deleteInvite(invite);
  }

  async removeSharing(user: User, id: Sharing['id']) {
    const sharing = await this.sharingRepository.findSharing(id);

    if (!sharing) {
      throw new NotFoundException();
    }

    if (!sharing.isOwnedBy(user)) {
      throw new ForbiddenException();
    }

    return this.sharingRepository.deleteSharing(id);
  }

  async getRoles(): Promise<Role[]> {
    return this.sharingRepository.findRoles();
  }

  async updateSharingRole(
    user: User,
    id: SharingRole['id'],
    dto: UpdateSharingRoleDto,
  ): Promise<void> {
    const sharingRole = await this.sharingRepository.findSharingRole(id);

    if (!sharingRole) {
      throw new NotFoundException();
    }

    const sharing = await this.sharingRepository.findSharing(
      sharingRole.sharingId,
    );

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

    await this.sharingRepository.updateSharingRole(id, dto);
  }

  async removeSharingRole(
    user: User,
    sharingRoleId: SharingRole['id'],
  ): Promise<void> {
    const sharingRole = await this.sharingRepository.findSharingRole(
      sharingRoleId,
    );

    if (!sharingRole) {
      throw new NotFoundException();
    }

    const sharing = await this.sharingRepository.findSharing(
      sharingRole.sharingId,
    );

    if (!sharing) {
      throw new NotFoundException();
    }

    let item: File | Folder;

    if (sharing.itemType === 'file') {
      throw new Error('Not implemented yet');
    } else if (sharing.itemType === 'folder') {
      item = await this.folderUsecases.getByUuid(sharing.itemId);
    }

    if (!item) {
      throw new NotFoundException();
    }

    const isTheUserAuthorizedToRemoveTheRole = item.isOwnedBy(user);

    if (!isTheUserAuthorizedToRemoveTheRole) {
      throw new ForbiddenException();
    }
    await this.sharingRepository.deleteSharingRole(sharingRole);
  }
}
