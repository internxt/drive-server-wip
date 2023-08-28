import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  PermissionModel,
  RoleModel,
  SharingInviteModel,
  SharingModel,
  SharingRolesModel,
} from './models';
import {
  Sharing,
  SharingInvite,
  SharingRole,
  SharingRoleAttributes,
} from './sharing.domain';

interface SharingRepository {
  getInvitesByItem(
    itemId: SharingInvite['itemId'],
    itemType: SharingInvite['itemType'],
  ): Promise<SharingInvite[]>;
  createInvite(invite: Omit<SharingInvite, 'id'>): Promise<SharingInvite>;
  createSharing(sharing: Omit<Sharing, 'id'>): Promise<Sharing>;
  deleteInvite(invite: SharingInvite): Promise<void>;

  findSharing(sharingId: Sharing['id']): Promise<Sharing | null>;
  deleteSharing(id: Sharing['id']): Promise<void>;

  findSharingRole(
    sharingRoleId: SharingRole['id'],
  ): Promise<SharingRole | null>;
  updateSharingRole(
    sharingRoleId: SharingRole['id'],
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void>;

  findRoles(): Promise<RoleModel[]>;
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
    sharingRoleId: SharingRole['id'],
  ): Promise<SharingRole | null> {
    return this.sharingRoles.findByPk(sharingRoleId);
  }

  async updateSharingRole(
    sharingRoleId: SharingRole['id'],
    update: Partial<Omit<SharingRole, 'id'>>,
  ): Promise<void> {
    await this.sharingRoles.update(update, { where: { id: sharingRoleId } });
  }

  async findRoles(): Promise<RoleModel[]> {
    return this.roles.findAll();
  }

  async findSharing(sharingId: Sharing['id']): Promise<Sharing | null> {
    const raw = await this.sharings.findByPk(sharingId);

    return Sharing.build(raw);
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
