import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';

export interface PrivateSharingRolesRepository {
  findByFolder(folderUuid: Folder['uuid']): Promise<PrivateSharingFolderRole[]>;
  findByFolderAndUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolderRole[]>;
  removeByFolder(folderUuid: Folder['uuid']): Promise<any>;
  removeByUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<any>;
}

@Injectable()
export class PrivateSharingFolderRolesRepository
  implements PrivateSharingRolesRepository
{
  constructor(
    @InjectModel(PrivateSharingFolderRolesModel)
    private privateSharingFolderRolesModel: typeof PrivateSharingFolderRolesModel,
  ) {}

  private async removeByField(fields: Partial<PrivateSharingFolderRole>) {
    const privateFolder = await this.privateSharingFolderRolesModel.destroy({
      where: fields,
    });
    return privateFolder;
  }

  async removeByUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<any> {
    return await this.removeByField({ folderId: folderUuid, userId: userUuid });
  }

  async removeByFolder(folderUuid: Folder['uuid']): Promise<any> {
    return await this.removeByField({ folderId: folderUuid });
  }

  async findByFolder(
    folderUuid: Folder['uuid'],
  ): Promise<PrivateSharingFolderRole[]> {
    const sharedFolderRolesByFolder =
      await this.privateSharingFolderRolesModel.findAll({
        where: { folderId: folderUuid },
      });
    return sharedFolderRolesByFolder;
  }

  async findByFolderAndUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolderRole[]> {
    const sharedFolderRolesByFolderAndUser =
      await this.privateSharingFolderRolesModel.findAll({
        where: { folderId: folderUuid, userId: userUuid },
      });
    return sharedFolderRolesByFolderAndUser;
  }
}
