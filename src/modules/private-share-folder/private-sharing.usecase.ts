import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { FolderUseCases } from '../folder/folder.usecase';

export class InvalidOwnerError extends Error {
  constructor() {
    super('You are not the owner of this folder');
  }
}
@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private privateSharingFolderRolesRespository: PrivateSharingFolderRolesRepository,
    private readonly folderUseCases: FolderUseCases,
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
    await this.folderUseCases.getFolderByUuid(folderUuid);
    const folderRolesRemoved = await this.privateSharingFolderRolesRespository.removeByFolderUuid(folderUuid);
    const sharingRemoved = await this.privateSharingRespository.removeByFolderUuid(folderUuid);
    return {sharingRemoved, folderRolesRemoved};
  }

  async removeUserShared(folderUuid: Folder['uuid'], userUuid: User['uuid']): Promise<any>{
    await this.folderUseCases.getFolderByUuid(folderUuid);
    const folderRolesRemoved = await this.privateSharingFolderRolesRespository.removeByUserUuid(folderUuid,userUuid);
    const userSharedRemoved = await this.privateSharingRespository.removeBySharedWith(folderUuid, userUuid);
    return {userSharedRemoved, folderRolesRemoved};
  }
}