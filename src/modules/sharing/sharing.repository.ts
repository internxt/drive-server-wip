import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  PermissionModel,
  RoleModel,
  SharingInviteModel,
  SharingModel,
} from './models';
import { SharingRolesModel } from './models/sharing-roles.model';
import {
  Permission,
  Role,
  SharedWithType,
  Sharing,
  type SharingAttributes,
  SharingInvite,
  SharingRole,
  type SharingRoleAttributes,
  type SharingType,
} from './sharing.domain';
import { User } from '../user/user.domain';
import { Folder } from '../folder/folder.domain';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';
import sequelize, { Op, type WhereOptions } from 'sequelize';
import { type GetInviteDto, type GetInvitesDto } from './dto/get-invites.dto';
import { File, FileStatus } from '../file/file.domain';
import { FileModel } from '../file/file.model';
import { type PreCreatedUserAttributes } from '../user/pre-created-users.attributes';
import { type WorkspaceTeamAttributes } from '../workspaces/attributes/workspace-team.attributes';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { type WorkspaceItemUserAttributes } from '../workspaces/attributes/workspace-items-users.attributes';
import { type WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';

interface SharingRepository {
  getInvitesByItem(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
  ): Promise<SharingInvite[]>;
  createInvite(invite: Omit<SharingInvite, 'id'>): Promise<SharingInvite>;
  createSharing(sharing: Omit<Sharing, 'id'>): Promise<Sharing>;
  deleteInvite(invite: SharingInvite): Promise<void>;

  findAllSharing(
    where: Partial<Sharing>,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]>;
  deleteSharing(id: Sharing['id']): Promise<void>;

  findSharingRole(
    sharingRoleId: SharingRole['id'],
  ): Promise<SharingRole | null>;
  updateSharingRole(
    sharingRoleId: SharingRole['id'],
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void>;

  findRoles(): Promise<Role[]>;
  deleteSharingRole(sharingRole: SharingRole): Promise<void>;
  deleteSharingRolesBySharing(sharing: Sharing): Promise<void>;
  getSharingsCountBy(where: Partial<Sharing>): Promise<number>;
  getInvitesCountBy(where: Partial<SharingInvite>): Promise<number>;
  getInvitesNumberByItem(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
  ): Promise<number>;
  findPermissionsInSharing(
    sharedWith: Sharing['sharedWith'] | Sharing['sharedWith'][],
    sharedWithType: Sharing['sharedWithType'],
    itemId: Sharing['itemId'],
  ): Promise<Permission[]>;
  findSharingsWithRolesByItem(
    item: File | Folder,
  ): Promise<(SharingAttributes & { role: Role })[]>;
  findOneSharingBy(where: Partial<Sharing>): Promise<Sharing | null>;
  findRoleBy(where: Partial<Role>): Promise<Role | null>;
  findSharingById(sharingId: Sharing['id']): Promise<Sharing | null>;
  findSharingRoleBy(where: Partial<SharingRole>): Promise<SharingRole | null>;
  findOneByOwnerOrSharedWithItem(
    userId: User['uuid'],
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    type?: SharingType,
    sharedWithType?: SharedWithType,
  ): Promise<Sharing>;
  findSharingsWithRolesBySharedWith(
    users: User[],
  ): Promise<(SharingAttributes & { role: Role })[]>;
  findSharingsWithRoles(
    where: any,
  ): Promise<(SharingAttributes & { role: Role })[]>;
  findOneSharing(where: Partial<Sharing>): Promise<Sharing | null>;
  findSharingsBySharedWithAndAttributes(
    sharedWithValues: SharingAttributes['sharedWith'][],
    filters: Omit<Partial<SharingAttributes>, 'sharedWith'>,
    options?: { offset: number; limit: number; givePriorityToRole?: string },
  ): Promise<Sharing[]>;
  findFilesSharedInWorkspaceByOwnerAndTeams(
    ownerId: any,
    workspaceId: any,
    teamIds: any[],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<Sharing[]>;
  findFoldersSharedInWorkspaceByOwnerAndTeams(
    ownerId: any,
    workspaceId: any,
    teamsIds: any[],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<Sharing[]>;
  getInvites(
    where: Partial<SharingInvite>,
    limit: number,
    offset: number,
  ): Promise<GetInvitesDto>;
  getInviteById(inviteId: SharingInvite['id']): Promise<SharingInvite | null>;
  getInviteByItemAndUser(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
    sharedWith: SharingInvite['sharedWith'],
  ): Promise<SharingInvite | null>;
  createSharingRole(
    sharingRole: Omit<SharingRoleAttributes, 'id'>,
  ): Promise<void>;
  updateSharingRoleBy(
    where: Partial<SharingRole>,
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void>;
  updateSharing(
    where: Partial<Sharing>,
    update: Partial<Omit<Sharing, 'id'>>,
  ): Promise<void>;
  deleteInvitesBy(where: Partial<SharingInvite>): Promise<void>;
  bulkDeleteInvites(
    itemIds: SharingInvite['itemId'][],
    type: SharingInvite['itemType'],
  ): Promise<void>;
  bulkDeleteSharings(
    userUuid: User['uuid'],
    itemIds: SharingInvite['itemId'][],
    type: SharingInvite['itemType'],
    sharedWithType: SharedWithType,
  ): Promise<void>;
  deleteSharingsBy(where: Partial<Sharing>): Promise<void>;
}

@Injectable()
export class SequelizeSharingRepository implements SharingRepository {
  constructor(
    @InjectModel(PermissionModel)
    private readonly permissions: typeof PermissionModel,
    @InjectModel(RoleModel)
    private readonly roles: typeof RoleModel,
    @InjectModel(SharingRolesModel)
    private readonly sharingRoles: typeof SharingRolesModel,
    @InjectModel(SharingModel)
    private readonly sharings: typeof SharingModel,
    @InjectModel(SharingInviteModel)
    private readonly sharingInvites: typeof SharingInviteModel,
  ) {}

  getSharingsCountBy(where: Partial<Sharing>): Promise<number> {
    return this.sharings.count({ where });
  }

  getInvitesCountBy(where: Partial<SharingInvite>): Promise<number> {
    return this.sharingInvites.count({ where });
  }

  getInvitesNumberByItem(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
  ): Promise<number> {
    return this.sharingInvites.count({ where: { itemId, itemType } });
  }

  findSharingRole(
    sharingRoleId: SharingRole['id'],
  ): Promise<SharingRole | null> {
    return this.sharingRoles.findByPk(sharingRoleId);
  }

  async findPermissionsInSharing(
    sharedWith: Sharing['sharedWith'] | Sharing['sharedWith'][],
    sharedWithType: Sharing['sharedWithType'],
    itemId: Sharing['itemId'],
  ) {
    const sharedWithFilter = Array.isArray(sharedWith)
      ? { [Op.in]: sharedWith }
      : sharedWith;

    const permissions = await this.permissions.findAll({
      group: 'PermissionModel.id',
      include: [
        {
          model: RoleModel,
          required: true,
          attributes: [],
          include: [
            {
              model: SharingRolesModel,
              required: true,
              attributes: [],
              include: [
                {
                  model: SharingModel,
                  attributes: [],
                  where: {
                    sharedWith: sharedWithFilter,
                    itemId,
                    sharedWithType,
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    return permissions.map((permission) => this.toDomainPermission(permission));
  }

  async findSharingsWithRolesByItem(
    item: File | Folder,
  ): Promise<(SharingAttributes & { role: Role })[]> {
    return this.findSharingsWithRoles({
      itemId: item.uuid,
      itemType: (item as any).fileId ? 'file' : 'folder',
      sharedWith: {
        [Op.not]: '00000000-0000-0000-0000-000000000000',
      },
    });
  }

  async findByOwnerOrSharedWithFolderId(
    userId: User['uuid'],
    itemId: Sharing['itemId'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Sharing[]> {
    const privateFolderSharing = await this.sharings.findAll({
      where: {
        itemId,
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      order: orderBy,
      limit,
      offset,
    });

    return privateFolderSharing.map((sharing) => sharing.get({ plain: true }));
  }

  async updateSharingRole(
    sharingRoleId: SharingRole['id'],
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void> {
    await this.sharingRoles.update(update, { where: { id: sharingRoleId } });
  }

  async updateSharing(
    where: Partial<Sharing>,
    update: Partial<Omit<Sharing, 'id'>>,
  ): Promise<void> {
    await this.sharings.update(update, { where });
  }

  async updateSharingRoleBy(
    where: Partial<SharingRole>,
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void> {
    await this.sharingRoles.update(update, { where });
  }

  async findOneSharingBy(where: Partial<Sharing>): Promise<Sharing | null> {
    const raw = await this.sharings.findOne({ where });

    return raw ? Sharing.build(raw) : null;
  }

  async findRoleBy(where: Partial<Role>): Promise<Role | null> {
    const raw = await this.roles.findOne({ where });

    return raw ? Role.build(raw) : null;
  }

  async findRoles(): Promise<Role[]> {
    const roles = await this.roles.findAll();

    return roles.map((r) => Role.build(r));
  }

  async findSharingById(sharingId: Sharing['id']): Promise<Sharing | null> {
    const raw = await this.sharings.findByPk(sharingId);

    return Sharing.build(raw);
  }

  async findSharingRoleBy(
    where: Partial<SharingRole>,
  ): Promise<SharingRole | null> {
    const raw = await this.sharingRoles.findOne({
      where,
      include: [
        {
          model: RoleModel,
          as: 'role',
        },
      ],
    });

    return raw ? SharingRole.build(raw) : null;
  }

  async findOneByOwnerOrSharedWithItem(
    userId: User['uuid'],
    itemId: Sharing['itemId'],
    itemType: Sharing['itemType'],
    type?: SharingType,
    sharedWithType?: SharedWithType,
  ): Promise<Sharing> {
    const optionalWhere = {
      ...(type ? { type } : null),
      ...(sharedWithType ? { sharedWithType } : null),
    };

    const raw = await this.sharings.findOne({
      where: {
        itemId,
        itemType,
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
        ...optionalWhere,
      },
    });

    return raw ? Sharing.build(raw) : null;
  }

  private async findSharingRoles(
    where: Partial<SharingRole>,
  ): Promise<SharingRole[]> {
    const raw = await this.sharingRoles.findAll({
      where,
    });

    return raw.map((model) => model.get({ plain: true }));
  }

  async findSharingsWithRolesBySharedWith(
    users: User[],
  ): Promise<(SharingAttributes & { role: Role })[]> {
    return this.findSharingsWithRoles({
      sharedWith: {
        [Op.in]: users.map((user) => user.uuid),
      },
    });
  }

  async findSharingsWithRoles(
    where: WhereOptions<Sharing>,
  ): Promise<(SharingAttributes & { role: Role })[]> {
    const sharingsInRaw = await this.sharings.findAll({
      where,
    });

    const sharingRoles = await this.sharingRoles.findAll({
      where: {
        sharingId: {
          [Op.in]: sharingsInRaw.map((s) => s.id),
        },
      },
      include: [
        {
          model: RoleModel,
          as: 'role',
        },
      ],
    });

    return sharingsInRaw.map((sharing) => {
      return {
        ...sharing.get({ plain: true }),
        role: sharingRoles
          .find((sr) => sr.sharingId === sharing.id)
          .role.get({ plain: true }),
      };
    });
  }

  async findOneSharing(where: Partial<Sharing>): Promise<Sharing | null> {
    const raw = await this.sharings.findOne({ where });

    return raw ? Sharing.build(raw) : null;
  }

  async findAllSharing(
    where: Partial<Sharing>,
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Folder[]> {
    const sharedFolders = await this.sharings.findAll({
      where,
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

  async findSharingByItemAndSharedWith(
    itemId: Sharing['itemId'],
    sharedWith: Sharing['sharedWith'],
  ): Promise<Sharing | null> {
    const sharing = await this.sharings.findOne({
      where: {
        itemId,
        sharedWith,
      },
    });
    return sharing ? Sharing.build(sharing) : null;
  }

  async findByOwnerAndSharedWithMe(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Sharing[]> {
    const sharedFolders = await this.sharings.findAll({
      where: {
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      attributes: [
        [
          sequelize.literal(`MAX("SharingModel"."encryption_key")`),
          'encryptionKey',
        ],
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      group: ['folder.id', 'folder->user.id', 'SharingModel.item_id'],
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
              as: 'user',
              attributes: [
                'uuid',
                'email',
                'name',
                'lastname',
                'avatar',
                'userId',
                'bridgeUser',
              ],
            },
          ],
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFolders.map((shared) => {
      return this.toDomain(shared);
    });
  }

  async getUserRelatedSharedFilesInfo(
    userId: User['uuid'],
    offset: number,
    limit: number,
  ): Promise<Pick<Sharing, 'encryptionKey' | 'createdAt' | 'itemId'>[]> {
    const sharedFiles = await this.sharings.findAll({
      attributes: [
        'itemId',
        [
          sequelize.literal(`MAX("SharingModel"."encryption_key")`),
          'encryptionKey',
        ],
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      where: {
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      group: ['itemId'],
      include: [
        {
          model: FileModel,
          attributes: [],
          where: {
            status: FileStatus.EXISTS,
          },
        },
      ],
      limit,
      offset,
    });

    return sharedFiles.map((data) => ({
      itemId: data.itemId,
      encryptionKey: data.encryptionKey,
      createdAt: data.createdAt,
    }));
  }

  /**
   * @deprecated Groups by file.id instead of itemId (UUID). Use getUserRelatedSharedFilesInfo() + getFilesAndUserByUuid() instead.
   * @see SharingService.getSharedFiles for migration example
   */
  async findFilesByOwnerAndSharedWithMe(
    userId: User['uuid'],
    offset: number,
    limit: number,
    orderBy?: [string, string][],
  ): Promise<Sharing[]> {
    const sharedFiles = await this.sharings.findAll({
      where: {
        [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
      },
      attributes: [
        [
          sequelize.literal(`MAX("SharingModel"."encryption_key")`),
          'encryptionKey',
        ],
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      group: ['file.id', 'file->user.id', 'SharingModel.item_id'],
      include: [
        {
          model: FileModel,
          where: {
            status: FileStatus.EXISTS,
          },
          include: [
            {
              model: UserModel,
              as: 'user',
              attributes: [
                'uuid',
                'email',
                'name',
                'lastname',
                'avatar',
                'userId',
                'bridgeUser',
              ],
            },
          ],
        },
      ],
      order: orderBy,
      limit,
      offset,
    });

    return sharedFiles.map((shared) => {
      return this.toDomainFile(shared);
    });
  }

  async findSharingsBySharedWithAndAttributes(
    sharedWithValues: SharingAttributes['sharedWith'][],
    filters: Omit<Partial<SharingAttributes>, 'sharedWith'> = {},
    options?: { offset: number; limit: number; givePriorityToRole?: string },
  ): Promise<Sharing[]> {
    const where: WhereOptions<SharingAttributes> = {
      ...filters,
      sharedWith: {
        [Op.in]: sharedWithValues,
      },
    };

    const queryOrder = [];
    if (options?.givePriorityToRole) {
      queryOrder.push([
        sequelize.literal(
          `CASE WHEN "role->role"."name" = :priorityRole THEN 1 ELSE 2 END`,
        ),
        'ASC',
      ]);
    }

    const sharings = await this.sharings.findAll({
      where,
      include: [
        {
          model: SharingRolesModel,
          include: [RoleModel],
        },
      ],
      limit: options.limit,
      offset: options.offset,
      order: queryOrder,
      replacements: {
        priorityRole: options?.givePriorityToRole,
      },
    });

    return sharings.map((sharing) =>
      Sharing.build(sharing.get({ plain: true })),
    );
  }

  async getTeamsRelatedSharedFilesInfo(
    ownerId: WorkspaceItemUserAttributes['createdBy'],
    teamIds: WorkspaceTeamAttributes['id'][],
    workspaceId: WorkspaceAttributes['id'],
    options: { offset: number; limit: number },
  ): Promise<
    Pick<SharingAttributes, 'encryptionKey' | 'createdAt' | 'itemId'>[]
  > {
    const sharedFiles = await this.sharings.findAll({
      attributes: [
        'itemId',
        [
          sequelize.literal(`MAX("SharingModel"."encryption_key")`),
          'encryptionKey',
        ],
        [sequelize.literal(`MIN("SharingModel"."created_at")`), 'createdAt'],
      ],
      where: {
        [Op.or]: [
          {
            sharedWith: { [Op.in]: teamIds },
            sharedWithType: SharedWithType.WorkspaceTeam,
          },
          {
            '$file->workspaceUser.created_by$': ownerId,
          },
        ],
      },
      group: ['itemId'],
      include: [
        {
          model: FileModel,
          attributes: [],
          where: {
            status: FileStatus.EXISTS,
          },
          include: [
            {
              model: WorkspaceItemUserModel,
              as: 'workspaceUser',
              where: {
                workspaceId,
              },
              attributes: [],
            },
          ],
        },
      ],
      limit: options.limit,
      offset: options.offset,
    });

    return sharedFiles.map((data) => ({
      itemId: data.itemId,
      encryptionKey: data.encryptionKey,
      createdAt: data.createdAt,
    }));
  }

  /**
   * @deprecated Groups by file.id instead of itemId (UUID). Use getTeamsRelatedSharedFilesInfo() + fileRepository.getFilesWithWorkspaceUser() instead.
   * @see SharingService.getSharedFilesInWorkspaceByTeams for migration example
   */
  async findFilesSharedInWorkspaceByOwnerAndTeams(
    ownerId: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    teamIds: WorkspaceTeamAttributes['id'][],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<Sharing[]> {
    const sharedFiles = await this.sharings.findAll({
      where: {
        [Op.or]: [
          {
            sharedWith: { [Op.in]: teamIds },
            sharedWithType: SharedWithType.WorkspaceTeam,
          },
          {
            '$file->workspaceUser.created_by$': ownerId,
          },
        ],
      },
      attributes: [
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      group: [
        'SharingModel.item_id',
        'file.id',
        'file->workspaceUser.id',
        'file->workspaceUser->creator.id',
      ],
      include: [
        {
          model: FileModel,
          where: {
            status: FileStatus.EXISTS,
          },
          include: [
            {
              model: WorkspaceItemUserModel,
              as: 'workspaceUser',
              required: true,
              where: {
                workspaceId,
              },
              include: [
                {
                  model: UserModel,
                  as: 'creator',
                  attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
                },
              ],
            },
          ],
        },
      ],
      order: options.order,
      limit: options.limit,
      offset: options.offset,
    });

    return sharedFiles.map((shared) => {
      const sharing = shared.get({ plain: true });
      const user = sharing.file.workspaceUser?.creator;
      delete sharing.file.user;

      return Sharing.build({
        ...sharing,
        file: File.build({
          ...sharing.file,
          user: user ? User.build(user) : null,
        }),
      });
    });
  }

  async findFoldersSharedInWorkspaceByOwnerAndTeams(
    ownerId: WorkspaceItemUserAttributes['createdBy'],
    workspaceId: WorkspaceAttributes['id'],
    teamsIds: WorkspaceTeamAttributes['id'][],
    options: { offset: number; limit: number; order?: [string, string][] },
  ): Promise<Sharing[]> {
    const sharedFolders = await this.sharings.findAll({
      where: {
        [Op.or]: [
          {
            sharedWith: { [Op.in]: teamsIds },
            sharedWithType: SharedWithType.WorkspaceTeam,
          },
          {
            '$folder->workspaceUser.created_by$': ownerId,
          },
        ],
      },
      attributes: [
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      group: [
        'SharingModel.item_id',
        'folder.id',
        'folder->workspaceUser.id',
        'folder->workspaceUser->creator.id',
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
              model: WorkspaceItemUserModel,
              required: true,
              where: {
                workspaceId,
              },
              include: [
                {
                  model: UserModel,
                  as: 'creator',
                  attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
                },
              ],
            },
          ],
        },
      ],
      order: options.order,
      limit: options.limit,
      offset: options.offset,
    });

    return sharedFolders.map((shared) => {
      const sharing = shared.get({ plain: true });
      const user = sharing.folder.workspaceUser?.creator;

      return Sharing.build({
        ...sharing,
        folder: Folder.build({
          ...sharing.folder,
          user: user ? User.build(user) : null,
        }),
      });
    });
  }

  private toDomain(model: SharingModel): Sharing {
    const folder = model.folder.get({ plain: true });
    const user = model.folder.user.get({ plain: true });
    delete folder.user;

    return Sharing.build({
      ...model.get({ plain: true }),
      folder: Folder.build({
        ...folder,
        parent: folder.parent ? Folder.build(folder.parent) : null,
        user: user ? User.build(user) : null,
      }),
    });
  }

  private toDomainFile(model: SharingModel): Sharing {
    const file = model.file.get({ plain: true });
    const user = model.file.user.get({ plain: true });
    delete file.user;

    return Sharing.build({
      ...model.get({ plain: true }),
      file: File.build({
        ...file,
        user: user ? User.build(user) : null,
      }),
    });
  }

  private toDomainPermission(model: PermissionModel): Permission {
    return Permission.build({
      ...model.get({ plain: true }),
    });
  }

  async deleteSharing(id: Sharing['id']): Promise<void> {
    await this.sharings.destroy({ where: { id } });
  }

  async getInvites(
    where: Partial<SharingInvite>,
    limit: number,
    offset: number,
  ): Promise<GetInvitesDto> {
    const invitesWithInviteds = await this.sharingInvites.findAll({
      where,
      limit,
      offset,
      include: [
        {
          model: UserModel,
          as: 'invited',
          attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
          required: true,
        },
      ],
      nest: true,
    });

    return invitesWithInviteds.map((i) => i.toJSON<GetInviteDto>());
  }

  async getUserValidInvites(
    where: Partial<SharingInvite>,
    limit: number,
    offset: number,
  ): Promise<GetInvitesDto> {
    const invitesWithInviteds = await this.sharingInvites.findAll({
      where: {
        ...where,
        [Op.or]: [
          {
            [Op.and]: [
              { itemType: 'file' },
              { '$file.status$': FileStatus.EXISTS },
            ],
          },
          {
            [Op.and]: [
              { itemType: 'folder' },
              { '$folder.deleted$': false },
              { '$folder.removed$': false },
            ],
          },
        ],
      },
      limit,
      offset,
      include: [
        {
          model: FileModel,
          as: 'file',
          attributes: [],
        },
        {
          model: FolderModel,
          as: 'folder',
          attributes: [],
        },
        {
          model: UserModel,
          as: 'invited',
          attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
          required: true,
        },
      ],
      nest: true,
    });

    return invitesWithInviteds.map((i) => i.toJSON<GetInviteDto>());
  }

  async updateAllUserSharedWith(
    userUuid: PreCreatedUserAttributes['uuid'],
    update: Partial<SharingInvite>,
  ): Promise<void> {
    await this.sharingInvites.update(update, {
      where: {
        sharedWith: userUuid,
      },
    });
  }

  async getInvitesBySharedwith(
    userUuid: PreCreatedUserAttributes['uuid'],
  ): Promise<SharingInvite[]> {
    const invites = await this.sharingInvites.findAll({
      where: {
        sharedWith: userUuid,
      },
    });

    return invites.map((i) => SharingInvite.build(i.toJSON<SharingInvite>()));
  }

  async bulkUpdate(invites: Partial<SharingInvite>[]): Promise<void> {
    const updatePromises = invites.map((invite) =>
      this.sharingInvites.update(
        {
          sharedWith: invite.sharedWith,
          encryptionKey: invite.encryptionKey,
        },
        {
          where: {
            id: invite.id,
          },
        },
      ),
    );
    await Promise.all(updatePromises);
  }

  async getInvitesByItem(
    itemId: string,
    itemType: 'file' | 'folder',
  ): Promise<SharingInvite[]> {
    const rawInvites = await this.sharingInvites.findAll({
      where: {
        itemId,
        itemType,
      },
    });

    return rawInvites.map((invite) =>
      SharingInvite.build(invite.get({ plain: true })),
    );
  }

  async getInviteById(
    inviteId: SharingInvite['id'],
  ): Promise<SharingInvite | null> {
    const raw = await this.sharingInvites.findOne({
      where: {
        id: inviteId,
      },
    });

    return raw ? SharingInvite.build(raw) : null;
  }

  async getInviteByItemAndUser(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
    sharedWith: SharingInvite['sharedWith'],
  ): Promise<SharingInvite | null> {
    const raw = await this.sharingInvites.findOne({
      where: {
        itemId,
        itemType,
        sharedWith,
      },
    });

    return raw ? SharingInvite.build(raw) : null;
  }

  async createInvite(
    invite:
      | Omit<SharingInvite, 'id'>
      | Omit<SharingInvite, 'id' | 'encryptionKey' | 'encryptionAlgorithm'>,
  ): Promise<SharingInvite> {
    const raw = await this.sharingInvites.create(invite);

    return SharingInvite.build(raw);
  }

  async getSharedItemsNumberByUser(userUuid: string): Promise<number> {
    const sharingsCount = await this.sharings.count({
      where: { ownerId: userUuid },
      distinct: true,
      col: 'itemId',
    });

    return sharingsCount;
  }

  async createSharing(sharing: Omit<Sharing, 'id'>): Promise<Sharing> {
    const raw = await this.sharings.create(sharing);

    return Sharing.build(raw);
  }

  async createSharingRole(
    sharingRole: Omit<SharingRoleAttributes, 'id'>,
  ): Promise<void> {
    await this.sharingRoles.create(sharingRole);
  }

  async deleteSharingRole(sharingRole: SharingRole): Promise<void> {
    await this.sharingRoles.destroy({
      where: {
        id: sharingRole.id,
      },
    });
  }

  async deleteSharingRolesBySharing(sharing: Sharing): Promise<void> {
    await this.sharingRoles.destroy({
      where: {
        sharingId: sharing.id,
      },
    });
  }

  async deleteInvitesBy(where: Partial<SharingInvite>): Promise<void> {
    await this.sharingInvites.destroy({
      where,
    });
  }

  async bulkDeleteInvites(
    itemIds: SharingInvite['itemId'][],
    type: SharingInvite['itemType'],
  ): Promise<void> {
    await this.sharingInvites.destroy({
      where: {
        itemId: {
          [Op.in]: itemIds,
        },
        itemType: type,
      },
    });
  }

  async bulkDeleteSharings(
    userUuid: User['uuid'],
    itemIds: SharingInvite['itemId'][],
    type: SharingInvite['itemType'],
    sharedWithType: SharedWithType,
  ): Promise<void> {
    await this.sharings.destroy({
      where: {
        itemId: {
          [Op.in]: itemIds,
        },
        itemType: type,
        ownerId: userUuid,
        sharedWithType,
      },
    });
  }

  async deleteInvite(invite: SharingInvite): Promise<void> {
    await this.sharingInvites.destroy({
      where: {
        id: invite.id,
      },
    });
  }

  async deleteSharingsBy(where: Partial<Sharing>): Promise<void> {
    await this.sharings.destroy({
      where,
    });
  }
}
