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
import { QueryTypes } from 'sequelize';

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
    console.log('folderId', folderId);
    console.log('ownerId', ownerId);
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

  async findPrivateFolderRoleById(
    privateFolderRoleId: PrivateSharingFolderRole['id'],
  ): Promise<PrivateSharingFolderRole> {
    const privateFolderRole = await this.privateSharingFolderRole.findByPk(
      privateFolderRoleId,
    );

    return privateFolderRole.get({ plain: true });
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
      include: [FolderModel],
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
      include: [FolderModel],
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
      `,
      {
        replacements: { folderUuids },
        type: QueryTypes.SELECT,
      },
    );

    return users as (User & { sharedFrom: string })[];
  }
}
