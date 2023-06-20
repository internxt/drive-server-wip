import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModel } from '../folder/folder.model';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';

export interface PrivateSharingRepository {
  findSharedByMePrivateFolders(
    userId: number,
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

  async createPrivateFolderRole(user: User, folder: Folder, roleUuid: string) {
    await this.privateSharingFolderRole.create({
      userId: user.id,
      userUuid: user.uuid,
      folderId: folder.id,
      folderUuid: folder.uuid,
      roleId: roleUuid,
    });
  }

  async findSharedWithMePrivateFolders(
    userId: number,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        sharedWithId: userId,
      },
      include: [
        {
          model: this.folderModel,
          as: 'folder',
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }

  async findSharedByMePrivateFolders(
    userId: number,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        ownerId: userId,
      },
      include: [
        {
          model: this.folderModel,
          as: 'folder',
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }
}
