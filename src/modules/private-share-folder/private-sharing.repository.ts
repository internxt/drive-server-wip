import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModel } from '../folder/folder.model';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';
import { PrivateSharingRole } from './private-sharing-role.domain';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { UserModel } from '../user/user.model';

export interface PrivateSharingRepository {
  findByOwner(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
  findBySharedWith(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
  removeByFolderUuid(folderUuid: Folder['uuid']): Promise<number>;
  removeBySharedWith(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<number>;
  findByFolder(folderUuid: Folder['uuid']): Promise<PrivateSharingFolder[]>;
  findByFolderAndSharedWith(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolder[]>;
  findById(
    id: PrivateSharingFolder['id'],
  ): Promise<PrivateSharingFolder & { folder: Folder }>;
  findRoleById(roleId: PrivateSharingRole['id']): Promise<PrivateSharingRole>;
  create(
    owner: User,
    sharedWith: User,
    folder: Folder,
  ): Promise<PrivateSharingFolder>;
  updatePrivateFolderRole(
    privateFolderRoleId: PrivateSharingFolderRole['id'],
    roleId: PrivateSharingRole['id'],
  ): Promise<void>;
  findPrivateFolderRoleByFolderIdAndUserId(
    userId: User['uuid'],
    folderId: Folder['uuid'],
  ): Promise<PrivateSharingFolderRole | null>;
  createPrivateFolderRole(
    userId: User['uuid'],
    folderId: Folder['uuid'],
    roleId: PrivateSharingRole['id'],
  ): Promise<void>;
}

@Injectable()
export class SequelizePrivateSharingRepository
  implements PrivateSharingRepository
{
  constructor(
    @InjectModel(PrivateSharingFolderModel)
    private privateSharingFolderModel: typeof PrivateSharingFolderModel,
    @InjectModel(PrivateSharingFolderRolesModel)
    private privateSharingFolderRole: typeof PrivateSharingFolderRolesModel,
    @InjectModel(PrivateSharingRoleModel)
    private privateSharingRole: typeof PrivateSharingRoleModel,
  ) {}

  private async removeByField(
    fields: Partial<PrivateSharingFolder>,
  ): Promise<number> {
    const amountRemoves = await this.privateSharingFolderModel.destroy({
      where: fields,
    });
    return amountRemoves;
  }

  async removeByFolderUuid(folderUuid: string): Promise<number> {
    const privatesRemovedByFolderUuid = await this.removeByField({
      folderId: folderUuid,
    });
    return privatesRemovedByFolderUuid;
  }

  async removeBySharedWith(
    folderUuid: string,
    userUuid: string,
  ): Promise<number> {
    const sharedWithRemoved = await this.removeByField({
      folderId: folderUuid,
      sharedWith: userUuid,
    });
    return sharedWithRemoved;
  }

  async findById(
    id: PrivateSharingFolder['id'],
  ): Promise<PrivateSharingFolder & { folder: Folder }> {
    const privateFolder = await this.privateSharingFolderModel.findOne({
      where: {
        id,
      },
      include: [FolderModel],
    });

    return privateFolder?.get({ plain: true });
  }

  async findRoleById(
    roleId: PrivateSharingRole['id'],
  ): Promise<PrivateSharingRole> {
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

    return privateFolder?.get({ plain: true });
  }

  async updatePrivateFolderRole(
    privateFolderRoleId: PrivateSharingFolderRole['id'],
    roleId: PrivateSharingRole['id'],
  ): Promise<void> {
    await this.privateSharingFolderRole.update(
      {
        roleId,
      },
      {
        where: {
          id: privateFolderRoleId,
        },
      },
    );
  }

  async findPrivateFolderRoleByFolderIdAndUserId(
    userId: User['uuid'],
    folderId: Folder['uuid'],
  ): Promise<PrivateSharingFolderRole | null> {
    const privateFolderRole = await this.privateSharingFolderRole.findOne({
      where: {
        folderId: folderId,
        userId: userId,
      },
    });

    return privateFolderRole?.get({ plain: true });
  }

  async findPrivateFolderByFolderIdAndSharedWith(
    folderId: Folder['uuid'],
    sharedWith: User['uuid'],
  ): Promise<PrivateSharingFolder & { folder: Folder }> {
    const privateFolder = await this.privateSharingFolderModel.findOne({
      where: {
        folderId,
        sharedWith,
      },
      include: [FolderModel],
    });

    return privateFolder?.get({ plain: true });
  }

  async createPrivateFolderRole(
    userId: User['uuid'],
    folderId: Folder['uuid'],
    roleId: PrivateSharingRole['id'],
  ): Promise<void> {
    await this.privateSharingFolderRole.create({
      userId: userId,
      folderId: folderId,
      roleId: roleId,
    });
  }

  async findByOwner(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        ownerId: userId,
      },
      include: [
        FolderModel,
        {
          model: UserModel,
          foreignKey: 'ownerId',
          as: 'owner',
          attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }

  async findBySharedWith(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        sharedWith: userId,
      },
      include: [
        FolderModel,
        {
          model: UserModel,
          foreignKey: 'ownerId',
          as: 'owner',
          attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((folder) => folder.get({ plain: true }));
  }

  async findByFolder(
    folderUuid: Folder['uuid'],
  ): Promise<PrivateSharingFolder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        folderId: folderUuid,
      },
    });
    return sharedFolders;
  }

  async findByFolderAndSharedWith(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        folderId: folderUuid,
        sharedWith: userUuid,
      },
    });
    return sharedFolders;
  }

  async createPrivateFolder(
    folderId: Folder['uuid'],
    ownerUuid: User['uuid'],
    sharedWithUuid: User['uuid'],
    encryptionKey: PrivateSharingFolder['encryptionKey'],
  ): Promise<PrivateSharingFolder> {
    const privateFolder = await this.privateSharingFolderModel.create({
      folderId,
      ownerId: ownerUuid,
      sharedWith: sharedWithUuid,
      encryptionKey,
    });

    return privateFolder.get({ plain: true });
  }

  async getAllRoles(): Promise<PrivateSharingRole[]> {
    const roles = await this.privateSharingRole.findAll();

    return roles.map((role) => role.get({ plain: true }));
  }
}
