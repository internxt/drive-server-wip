import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModel } from '../folder/folder.model';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';
import { Op, col } from 'sequelize';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { PrivateSharingRoleModel } from './private-sharing-role.model';

export interface PrivateSharingRepository {
  findByOwner(
    userUuid: string,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
  findBySharedWith(
    userUuid: string,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
}

@Injectable()
export class SequelizePrivateSharingRepository
  implements PrivateSharingRepository
{
  constructor(
    @InjectModel(PrivateSharingFolderModel)
    private privateSharingFolderModel: typeof PrivateSharingFolderModel,
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
    @InjectModel(PrivateSharingFolderRolesModel)
    private privateSharingFolderRole: typeof PrivateSharingFolderRolesModel,
    @InjectModel(PrivateSharingRoleModel)
    private privateSharingRole: typeof PrivateSharingRoleModel,
  ) {}

  async findById(
    id: string,
  ): Promise<PrivateSharingFolder & { folder: Folder }> {
    const privateFolder = await this.privateSharingFolderModel.findOne({
      where: {
        id,
      },
      include: [
        {
          model: this.folderModel,
          required: true,
          foreignKey: 'folderId',
          on: {
            uuid: { [Op.eq]: col('PrivateSharingFolderModel.folder_id') },
          },
        },
      ],
    });

    return privateFolder.get({ plain: true });
  }

  async findRoleById(roleId: PrivateSharingRole['id']) {
    const role = await this.privateSharingRole.findByPk(roleId);
    return role?.get({ plain: true });
  }

  async create(
    owner: User,
    sharedWith: User,
    folder: Folder,
  ): Promise<PrivateSharingFolder> {
    const privateFolder = await this.privateSharingFolderModel.create({
      ownerId: owner.uuid,
      sharedWith: sharedWith.uuid,
      folderId: folder.uuid,
    });

    return privateFolder.get({ plain: true });
  }

  async updatePrivateFolderRole(
    privateFolderRole: PrivateSharingFolderRole,
    roleId: string,
  ): Promise<void> {
    await this.privateSharingFolderRole.update(
      {
        roleId,
      },
      {
        where: {
          id: privateFolderRole.id,
        },
      },
    );
  }

  async findPrivateFolderRoleById(
    privateFolderRoleId: string,
  ): Promise<PrivateSharingFolderRole> {
    const privateFolderRole = await this.privateSharingFolderRole.findByPk(
      privateFolderRoleId,
    );

    return privateFolderRole.get({ plain: true });
  }

  async findPrivateFolderRoleByFolderUuidAndUserUuid(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolderRole> {
    const privateFolderRole = await this.privateSharingFolderRole.findOne({
      where: {
        folderId: folderUuid,
        userId: userUuid,
      },
    });

    return privateFolderRole.get({ plain: true });
  }

  async createPrivateFolderRole(
    userId: string,
    folderId: string,
    roleUuid: string,
  ) {
    await this.privateSharingFolderRole.create({
      userId: userId,
      folderId: folderId,
      roleId: roleUuid,
    });
  }
  async findByOwner(
    userUuid: string,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        ownerId: userUuid,
      },
      include: [
        {
          model: this.folderModel,
          required: true,
          foreignKey: 'folderId',
          on: {
            uuid: { [Op.eq]: col('PrivateSharingFolderModel.folder_id') },
          },
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }

  async findBySharedWith(
    userUuid: string,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        sharedWith: userUuid,
      },
      include: [
        {
          model: this.folderModel,
          required: true,
          foreignKey: 'folderId',
          on: {
            uuid: { [Op.eq]: col('PrivateSharingFolderModel.folder_id') },
          },
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }
}
