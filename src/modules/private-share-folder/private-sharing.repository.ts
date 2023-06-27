import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModel } from '../folder/folder.model';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { Op, col } from 'sequelize';

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
  ) {}

  async findById(id: string): Promise<PrivateSharingFolder> {
    const privateFolder = await this.privateSharingFolderModel.findByPk(id);

    return privateFolder.get({ plain: true });
  }

  async createPrivateFolder(
    owner: User,
    sharedWith: User,
    folder: Folder,
  ): Promise<PrivateSharingFolder> {
    const privateFolder = await this.privateSharingFolderModel.create({
      ownerId: owner.id,
      ownerUuid: owner.uuid,
      sharedWithId: sharedWith.id,
      sharedWithUuid: sharedWith.uuid,
      folderId: folder.id,
      folderUuid: folder.uuid,
    });

    return privateFolder.get({ plain: true });
  }

  async createPrivateFolderRole(user: User, folder: Folder, roleUuid: string) {
    await this.privateSharingFolderRole.create({
      userId: user.uuid,
      folderId: folder.uuid,
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
          foreignKey: 'folderUuid',
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
          foreignKey: 'folderUuid',
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
