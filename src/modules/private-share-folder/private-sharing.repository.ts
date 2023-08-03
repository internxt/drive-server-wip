import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModel } from '../folder/folder.model';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingRole } from './private-sharing-role.domain';
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
}
