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
import { QueryTypes } from 'sequelize';
import { UserModel } from '../user/user.model';

export interface PrivateSharingRepository {
  findByOwner(
    userUuid: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
  findBySharedWith(
    userUuid: User['uuid'],
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

  async findByFolderIdAndOwnerId(
    folderId: Folder['uuid'],
    ownerId: User['uuid'],
  ): Promise<PrivateSharingFolder & { folder: Folder }> {
    const privateFolder = await this.privateSharingFolderModel.findOne({
      where: {
        folderId,
        ownerId,
      },
      include: [FolderModel],
    });

    return privateFolder?.get({ plain: true });
  }

  async updatePrivateFolderRole(
    privateFolderRole: PrivateSharingFolderRole,
    roleId: PrivateSharingRole['id'],
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

  async findPrivateFolderRoleByUserIdAndFolderId(
    userId: User['uuid'],
    folderId: Folder['uuid'],
  ): Promise<PrivateSharingFolderRole> {
    const privateFolderRole = await this.privateSharingFolderRole.findOne({
      where: {
        userId,
        folderId,
      },
    });

    return privateFolderRole?.get({ plain: true });
  }

  async createPrivateFolderRole(
    userUuid: User['uuid'],
    folderId: Folder['uuid'],
    roleUuid: PrivateSharingRole['id'],
  ) {
    await this.privateSharingFolderRole.create({
      userId: userUuid,
      folderId: folderId,
      roleId: roleUuid,
    });
  }
  async findByOwner(
    userUuid: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        ownerId: userUuid,
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
    userUuid: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.privateSharingFolderModel.findAll({
      where: {
        sharedWith: userUuid,
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

  async createPrivateFolder(
    folderId: Folder['uuid'],
    ownerUuid: User['uuid'],
    sharedWithUuid: User['uuid'],
    encryptionKey: PrivateSharingFolder['encryptionKey'],
  ) {
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
  async findSharedUsersByFolderUuids(
    folderUuids: string[],
    offset: number,
    limit: number,
    order?: [string, string][],
  ): Promise<(User & { sharedFrom: string })[]> {
    const users = await this.privateSharingFolderModel.sequelize.query(
      `
      SELECT DISTINCT "users"."avatar", "users"."id", "users"."uuid", "users"."email", "users"."name", "users"."lastname", "folders"."uuid" AS "grantedFrom", "folders"."plain_name" as "grantedFromPlainName","roles"."role" as "roleName", "roles"."id" as "roleId"
      FROM "users"
      INNER JOIN "private_sharing_folder_roles"
      ON "users"."uuid" = "private_sharing_folder_roles"."user_id"
      INNER JOIN "folders"
      ON "private_sharing_folder_roles"."folder_id" = "folders"."uuid"
      INNER JOIN "roles"
      ON "private_sharing_folder_roles"."role_id" = "roles"."id"
      WHERE "folders"."uuid" IN (:folderUuids)
      ${order ? `ORDER BY "users"."${order[0][0]}" ${order[0][1]}` : ''}
      LIMIT :limit
      OFFSET :offset
      `,
      {
        replacements: { folderUuids, limit, offset },
        type: QueryTypes.SELECT,
      },
    );

    return users as (User & { sharedFrom: string })[];
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
}
