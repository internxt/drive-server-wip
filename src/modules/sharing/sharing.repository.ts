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
  Role,
  Sharing,
  SharingAttributes,
  SharingInvite,
  SharingRole,
  SharingRoleAttributes,
} from './sharing.domain';
import { User } from '../user/user.domain';
import { Folder } from '../folder/folder.domain';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';
import sequelize, { Op, WhereOptions } from 'sequelize';

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
}

@Injectable()
export class SequelizeSharingRepository implements SharingRepository {
  constructor(
    @InjectModel(PermissionModel)
    private permissions: typeof PermissionModel,
    @InjectModel(RoleModel)
    private roles: typeof RoleModel,
    @InjectModel(SharingRolesModel)
    private sharingRoles: typeof SharingRolesModel,
    @InjectModel(SharingModel)
    private sharings: typeof SharingModel,
    @InjectModel(SharingInviteModel)
    private sharingInvites: typeof SharingInviteModel,
  ) {}

  findSharingRole(
    sharingRoleId?: SharingRole['id'],
  ): Promise<SharingRole | null> {
    return this.sharingRoles.findByPk(sharingRoleId);
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

  async findRoles(): Promise<Role[]> {
    const roles = await this.roles.findAll();

    return roles.map((r) => Role.build(r));
  }

  async findSharingById(sharingId: Sharing['id']): Promise<Sharing | null> {
    const raw = await this.sharings.findByPk(sharingId);

    return Sharing.build(raw);
  }

  async findSharingRoles(where: Partial<SharingRole>): Promise<SharingRole[]> {
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

  private async findSharingsWithRoles(
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

    return Sharing.build(raw);
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
        // TODO: to check if is necessary to show the encryption_key in this query
        [
          sequelize.literal(`MAX("SharingModel"."encryption_key")`),
          'encryptionKey',
        ],
        [sequelize.literal(`MAX("SharingModel"."created_at")`), 'createdAt'],
      ],
      group: ['folder.id', 'folder->user.id', 'SharingModel.owner_id'],
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

  async deleteSharing(id: Sharing['id']): Promise<void> {
    await this.sharings.destroy({ where: { id } });
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

    return SharingInvite.build(raw);
  }

  async getInviteByItemAndUser(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
    sharedWith: SharingInvite['sharedWith'],
  ): Promise<SharingInvite> {
    const raw = await this.sharingInvites.findOne({
      where: {
        itemId,
        itemType,
        sharedWith,
      },
    });

    return SharingInvite.build(raw);
  }

  async createInvite(
    invite:
      | Omit<SharingInvite, 'id'>
      | Omit<SharingInvite, 'id' | 'encryptionKey' | 'encryptionAlgorithm'>,
  ): Promise<SharingInvite> {
    const raw = await this.sharingInvites.create(invite);

    return SharingInvite.build(raw);
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

  async deleteInvite(invite: SharingInvite): Promise<void> {
    await this.sharingInvites.destroy({
      where: {
        id: invite.id,
      },
    });
  }
}