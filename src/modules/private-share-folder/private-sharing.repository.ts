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
import sequelize, { Op } from 'sequelize';

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
  findById(id: PrivateSharingFolder['id']): Promise<PrivateSharingFolder>;
  removeByFolder(folder: Folder): Promise<number>;
  removeBySharedWith(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<number>;
  findByFolder(folderUuid: Folder['uuid']): Promise<PrivateSharingFolder[]>;
  findByFolderAndSharedWith(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<PrivateSharingFolder | null>;
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

  private removeByField(where: Partial<PrivateSharingFolder>): Promise<number> {
    return this.privateSharingFolderModel.destroy({
      where,
    });
  }

  removeByFolder(folder: Folder): Promise<number> {
    return this.removeByField({
      folderId: folder.uuid,
    });
  }

  removeBySharedWith(
    folderUuid: Folder['uuid'],
    sharedWith: User['uuid'],
  ): Promise<number> {
    return this.removeByField({
      folderId: folderUuid,
      sharedWith,
    });
  }

  async findById(
    id: PrivateSharingFolder['id'],
  ): Promise<PrivateSharingFolder> {
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
  ): Promise<PrivateSharingFolder> {
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
        {
          model: FolderModel,
          where: {
            deleted: false,
            removed: false,
          },
        },
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

  async findByOwnerAndFolderId(
    userId: User['uuid'],
    folderId: Folder['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<PrivateSharingFolder[]> {
    const privateFolderSharing = await this.privateSharingFolderModel.findAll({
      where: {
        ownerId: userId,
        folderId,
      },
      order: orderBy,
      limit,
      offset,
    });

    return privateFolderSharing.map((folder) => folder.get({ plain: true }));
  }

  async findByOwnerOrSharedWithFolderId(
    userId: User['uuid'],
    folderId: Folder['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<PrivateSharingFolder[]> {
    const privateFolderSharing = await this.privateSharingFolderModel.findAll({
      where: {
        folderId,
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      order: orderBy,
      limit,
      offset,
    });

    return privateFolderSharing.map((sharing) => sharing.get({ plain: true }));
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
        {
          model: FolderModel,
          where: {
            deleted: false,
            removed: false,
          },
        },
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

  async findByOwnerAndSharedWithMe(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<PrivateSharingFolder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      attributes: [
        // TODO: to check if is necessary to show the encryption_key in this query
        [
          sequelize.literal(
            `MAX("PrivateSharingFolderModel"."encryption_key")`,
          ),
          'encryptionKey',
        ],
        [
          sequelize.literal(`MAX("PrivateSharingFolderModel"."created_at")`),
          'createdAt',
        ],
      ],
      group: [
        'folder.id',
        'folder->user.id',
        'PrivateSharingFolderModel.owner_id',
      ],
      include: [
        {
          model: FolderModel,
          where: {
            deleted: false,
            removed: false,
          },
          include: [
            {
              model: UserModel,
              foreignKey: 'userId',
              as: 'user',
              attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
            },
          ],
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((shared) => this.toDomain(shared));
  }

  async findByFolder(
    folderUuid: Folder['uuid'],
  ): Promise<PrivateSharingFolder[]> {
    const privateSharings = await this.privateSharingFolderModel.findAll({
      where: {
        folderId: folderUuid,
      },
    });

    return privateSharings.map((sharing) => sharing.get({ plain: true }));
  }

  async findByFolderAndSharedWith(
    folderUuid: Folder['uuid'],
    sharedWith: User['uuid'],
  ): Promise<PrivateSharingFolder | null> {
    const privateSharing = await this.privateSharingFolderModel.findOne({
      where: {
        folderId: folderUuid,
        sharedWith: sharedWith,
      },
    });

    return privateSharing?.get({ plain: true });
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

  private toDomain(model: PrivateSharingFolderModel): PrivateSharingFolder {
    const folder = model.folder.get({ plain: true });
    const user = model.folder.user.get({ plain: true });
    delete folder.user;

    return PrivateSharingFolder.build({
      ...model.get({ plain: true }),
      folder: Folder.build({
        ...folder,
        parent: folder.parent ? Folder.build(folder.parent) : null,
        user: user ? User.build(user) : null,
      }),
    });
  }
}
