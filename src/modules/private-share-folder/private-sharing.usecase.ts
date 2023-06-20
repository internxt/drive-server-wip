import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { Sequelize } from 'sequelize';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
    private userRespository: SequelizeUserRepository,
    private folderRespository: SequelizeFolderRepository,
  ) {}
  async grantPrivileges(
    owner: User,
    userUuid: string,
    privateFolderId: string,
    roleUuid: string,
  ) {
    const user = await this.userRespository.findByUuid(userUuid);
    const privateFolder = await this.privateSharingRespository.findById(
      privateFolderId,
    );
    const folder = await this.folderRespository.findByUuid(
      privateFolder.folderUuid,
    );

    const isOwner = await this.folderRespository.isOwner(owner, folder.id);

    if (!isOwner) {
      throw new Error('You are not the owner of this folder');
    }

    await this.privateSharingRespository.createPrivateFolderRole(
      user,
      folder,
      roleUuid,
    );
  }

  async updateRole(owner: User, privateFolderRoleId: string, roleId: string) {
    const privateFolderRole =
      await this.privateSharingRespository.findPrivateFolderRoleById(
        privateFolderRoleId,
      );

    const folder = await this.folderRespository.findByUuid(
      privateFolderRole.folderUuid,
    );

    const isOwner = await this.folderRespository.isOwner(owner, folder.id);

    if (!isOwner) {
      throw new Error('You are not the owner of this folder');
    }

    await this.privateSharingRespository.updatePrivateFolderRole(
      privateFolderRole,
      roleId,
    );

    return {
      message: 'Role updated',
    };
  }

  async getSentFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders =
      await this.privateSharingRespository.findSharedByMePrivateFolders(
        user.id,
        offset,
        limit,
        order,
      );
    return folders;
  }

  async getReceivedFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders =
      await this.privateSharingRespository.findSharedWithMePrivateFolders(
        user.id,
        offset,
        limit,
        order,
      );
    return folders;
  }
}
