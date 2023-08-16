import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';

import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { PrivateSharingRole } from './private-sharing-role.domain';

export interface PrivateSharingRolesRepository {
  findByFolder(folderUuid: Folder['uuid']): Promise<PrivateSharingFolderRole[]>;
  findByFolderAndUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolderRole[]>;
  removeByFolder(folder: Folder): Promise<number>;
  removeByUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<number>;
  findByUsers(
    users: User[],
  ): Promise<(PrivateSharingFolderRole & { role: PrivateSharingRole })[]>;
}

@Injectable()
export class PrivateSharingFolderRolesRepository
  implements PrivateSharingRolesRepository
{
  constructor(
    @InjectModel(PrivateSharingFolderRolesModel)
    private privateSharingFolderRolesModel: typeof PrivateSharingFolderRolesModel,
  ) {}

  private removeByField(
    where: Partial<Record<keyof PrivateSharingFolderRole, any>>,
  ): Promise<number> {
    return this.privateSharingFolderRolesModel.destroy({
      where,
    });
  }

  removeByUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<number> {
    return this.removeByField({ folderId: folderUuid, userId: userUuid });
  }

  removeByFolder(folder: Folder): Promise<number> {
    return this.removeByField({ folderId: folder.uuid });
  }

  async findByFolder(
    folderUuid: Folder['uuid'],
  ): Promise<PrivateSharingFolderRole[]> {
    const rolesByFolder = await this.privateSharingFolderRolesModel.findAll({
      where: { folderId: folderUuid },
    });
    return rolesByFolder.map((role) =>
      role.get({
        plain: true,
      }),
    );
  }

  async findByFolderAndUser(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolderRole[]> {
    const folderRolesByFolderAndUser =
      await this.privateSharingFolderRolesModel.findAll({
        where: { folderId: folderUuid, userId: userUuid },
      });
    return folderRolesByFolderAndUser.map((role) =>
      role.get({
        plain: true,
      }),
    );
  }

  async findByUsers(
    users: User[],
  ): Promise<(PrivateSharingFolderRole & { role: PrivateSharingRole })[]> {
    const folderRoles = await this.privateSharingFolderRolesModel.findAll({
      where: {
        userId: {
          [Op.in]: users.map((user) => user.uuid),
        },
      },
      include: [PrivateSharingRoleModel],
    });
    return folderRoles.map((role) =>
      role.get({
        plain: true,
      }),
    );
  }
}
