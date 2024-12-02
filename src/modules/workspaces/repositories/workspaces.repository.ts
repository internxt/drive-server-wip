import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOrCreateOptions } from 'sequelize/types';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Workspace } from '../domains/workspaces.domain';
import { WorkspaceModel } from '../models/workspace.model';
import { WorkspaceUserModel } from '../models/workspace-users.model';
import { WorkspaceUser } from '../domains/workspace-user.domain';
import { WorkspaceInviteModel } from '../models/workspace-invite.model';
import { WorkspaceInvite } from '../domains/workspace-invite.domain';
import { WorkspaceInviteAttributes } from '../attributes/workspace-invite.attribute';
import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { Op } from 'sequelize';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import {
  WorkspaceItemType,
  WorkspaceItemUserAttributes,
} from '../attributes/workspace-items-users.attributes';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { FileModel } from '../../file/file.model';
import { FileAttributes } from '../../file/file.domain';
import { FolderAttributes } from '../../folder/folder.domain';
import { FolderModel } from '../../folder/folder.model';
import {
  SequelizeTransactionAdapter,
  Transaction,
} from '../../../externals/sequelize/sequelize-transaction';

@Injectable()
export class SequelizeWorkspaceRepository {
  constructor(
    @InjectModel(WorkspaceModel)
    private readonly modelWorkspace: typeof WorkspaceModel,
    @InjectModel(WorkspaceUserModel)
    private readonly modelWorkspaceUser: typeof WorkspaceUserModel,
    @InjectModel(WorkspaceInviteModel)
    private readonly modelWorkspaceInvite: typeof WorkspaceInviteModel,
    @InjectModel(WorkspaceItemUserModel)
    private readonly modelWorkspaceItemUser: typeof WorkspaceItemUserModel,
  ) {}
  async findById(id: WorkspaceAttributes['id']): Promise<Workspace | null> {
    const workspace = await this.modelWorkspace.findByPk(id);
    return workspace ? this.toDomain(workspace) : null;
  }

  async findWorkspaceAndDefaultUser(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<{ workspaceUser: User; workspace: Workspace } | null> {
    const workspaceAndDefaultUser = await this.modelWorkspace.findOne({
      where: { id: workspaceId },
      include: {
        model: UserModel,
        as: 'workpaceUser',
        required: true,
      },
    });

    if (!workspaceAndDefaultUser) {
      return null;
    }

    return {
      workspaceUser: User.build({
        ...workspaceAndDefaultUser.workpaceUser.get({ plain: true }),
      }),
      workspace: this.toDomain(workspaceAndDefaultUser),
    };
  }

  async findByOwner(ownerId: Workspace['ownerId']): Promise<Workspace[]> {
    const workspaces = await this.modelWorkspace.findAll({
      where: { ownerId },
    });
    return workspaces.map((workspace) => this.toDomain(workspace));
  }

  async createTransaction(): Promise<Transaction> {
    const transaction = await this.modelWorkspace.sequelize.transaction();
    return new SequelizeTransactionAdapter(transaction);
  }

  findOrCreate(
    opts: FindOrCreateOptions,
  ): Promise<[Workspace | null, boolean]> {
    return this.modelWorkspace.findOrCreate(opts) as any;
  }

  async findOne(
    where: Partial<WorkspaceAttributes>,
    options?: { transaction?: Transaction },
  ): Promise<Workspace | null> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    const workspace = await this.modelWorkspace.findOne({
      where,
      ...options,
      transaction: sequelizeTransaction,
    });

    return workspace ? this.toDomain(workspace) : null;
  }

  async findInvite(
    where: Partial<WorkspaceInviteAttributes>,
    options?: { transaction?: Transaction },
  ): Promise<WorkspaceInvite | null> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;

    const invite = await this.modelWorkspaceInvite.findOne({
      where,
      ...options,
      transaction: sequelizeTransaction,
      lock: sequelizeTransaction
        ? {
            level: sequelizeTransaction.LOCK.UPDATE,
            of: this.modelWorkspaceInvite,
          }
        : undefined,
    });

    return invite ? WorkspaceInvite.build(invite) : null;
  }

  async findInvitesBy(
    where: Partial<WorkspaceInvite>,
    limit?: number,
    offset?: number,
  ): Promise<WorkspaceInvite[]> {
    const invites = await this.modelWorkspaceInvite.findAll({
      where,
      limit,
      offset,
    });

    return invites.map((invite) => WorkspaceInvite.build(invite));
  }

  async bulkUpdateInvitesKeysAndUsers(
    invites: Partial<WorkspaceInvite>[],
  ): Promise<void> {
    const updatePromises = invites.map((invite) =>
      this.modelWorkspaceInvite.update(
        {
          invitedUser: invite.invitedUser,
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

  async deleteInviteBy(
    where: Partial<WorkspaceInviteAttributes>,
    options?: { transaction: Transaction },
  ): Promise<void> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    await this.modelWorkspaceInvite.destroy({
      where,
      ...options,
      transaction: sequelizeTransaction,
    });
  }

  async getWorkspaceInvitationsCount(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<number> {
    const totalInvites = await this.modelWorkspaceInvite.count({
      where: { workspaceId: workspaceId },
    });

    return totalInvites;
  }

  async findWorkspaceUser(
    where: Partial<WorkspaceUserAttributes>,
    includeUser = false,
    options?: { transaction?: Transaction },
  ): Promise<WorkspaceUser> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    const workspaceUser = await this.modelWorkspaceUser.findOne({
      where,
      include: includeUser ? [{ model: UserModel, as: 'member' }] : [],
      ...options,
      transaction: sequelizeTransaction,
      lock: sequelizeTransaction
        ? {
            level: sequelizeTransaction.LOCK.UPDATE,
            of: this.modelWorkspaceUser,
          }
        : undefined,
    });

    return workspaceUser ? this.workspaceUserToDomain(workspaceUser) : null;
  }

  async deleteWorkspaceInviteById(
    inviteId: WorkspaceInviteAttributes['id'],
  ): Promise<void> {
    await this.modelWorkspaceInvite.destroy({ where: { id: inviteId } });
  }

  async createItem(
    item: Omit<WorkspaceItemUserAttributes, 'id'>,
    options?: { transaction?: Transaction },
  ): Promise<WorkspaceItemUser | null> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    const newItem = await this.modelWorkspaceItemUser.create(item, {
      ...options,
      transaction: sequelizeTransaction,
    });

    return newItem ? this.workspaceItemUserToDomain(newItem) : null;
  }

  async getItemsBy(
    where: Partial<WorkspaceItemUserAttributes>,
  ): Promise<WorkspaceItemUser[]> {
    const items = await this.modelWorkspaceItemUser.findAll({ where });
    return items.map((item) => this.workspaceItemUserToDomain(item));
  }

  getItemsCountBy(
    where: Partial<WorkspaceItemUserAttributes>,
  ): Promise<number> {
    return this.modelWorkspaceItemUser.count({ where });
  }

  getItemFilesCountBy(
    where: Partial<Omit<WorkspaceItemUserAttributes, 'itemType'>>,
    whereFile?: Partial<FileAttributes>,
  ): Promise<number> {
    return this.modelWorkspaceItemUser.count({
      where: { ...where, itemType: WorkspaceItemType.File },
      include: { model: FileModel, where: { ...whereFile } },
    });
  }

  getItemFoldersCountBy(
    where: Partial<Omit<WorkspaceItemUserAttributes, 'itemType'>>,
    whereFolder?: Partial<FolderAttributes>,
  ): Promise<number> {
    return this.modelWorkspaceItemUser.count({
      where: { ...where, itemType: WorkspaceItemType.Folder },
      include: { model: FolderModel, where: { ...whereFolder } },
    });
  }

  async findWorkspaceResourcesOwner(
    workspaceId: WorkspaceItemUserAttributes['id'],
  ): Promise<User | null> {
    const workspaceUser = await this.modelWorkspace.findOne({
      where: { id: workspaceId },
      include: { model: UserModel, as: 'workpaceUser' },
    });

    return workspaceUser?.workpaceUser
      ? User.build({ ...workspaceUser?.workpaceUser.get({ plain: true }) })
      : null;
  }

  async getItemBy(
    where: Partial<WorkspaceItemUserAttributes>,
  ): Promise<WorkspaceItemUser | null> {
    const item = await this.modelWorkspaceItemUser.findOne({ where });

    return item ? this.workspaceItemUserToDomain(item) : null;
  }

  async updateItemBy(
    where: Partial<WorkspaceItemUserAttributes>,
    update: Partial<WorkspaceItemUserAttributes>,
  ): Promise<void> {
    await this.modelWorkspaceItemUser.update(update, { where });
  }
  async getItemsByAttributesAndCreator(
    createdBy: WorkspaceItemUserAttributes['createdBy'],
    items: Partial<Omit<WorkspaceItemUserAttributes, 'createdBy'>>[],
  ): Promise<WorkspaceItemUser[]> {
    const conditions = items.map((item) => ({
      ...item,
      createdBy,
    }));

    const foundItems = await this.modelWorkspaceItemUser.findAll({
      where: {
        [Op.or]: conditions,
      },
    });

    return foundItems.map((item) => this.workspaceItemUserToDomain(item));
  }

  async deleteUserFromWorkspace(
    memberId: WorkspaceUser['memberId'],
    workspaceId: WorkspaceUser['id'],
  ): Promise<void> {
    await this.modelWorkspaceUser.destroy({ where: { memberId, workspaceId } });
  }

  async getWorkspaceUsersCount(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<number> {
    const totalUsers = await this.modelWorkspaceUser.count({
      where: { workspaceId: workspaceId },
    });

    return totalUsers;
  }
  async getSpaceLimitInInvitations(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<number> {
    const totalSpaceLimit = await this.modelWorkspaceInvite.sum('spaceLimit', {
      where: { workspaceId: workspaceId },
    });

    return totalSpaceLimit || 0;
  }

  async getTotalSpaceLimitInWorkspaceUsers(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<number> {
    const total = await this.modelWorkspaceUser.sum('spaceLimit', {
      where: { workspaceId },
    });
    return total ?? 0;
  }

  async getTotalDriveAndBackupUsageWorkspaceUsers(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<number> {
    const [backupsUsageTotal, driveUsageTotal] = await Promise.all([
      this.modelWorkspaceUser.sum('backupsUsage', {
        where: { workspaceId },
      }),
      this.modelWorkspaceUser.sum('driveUsage', {
        where: { workspaceId },
      }),
    ]);

    return backupsUsageTotal + driveUsageTotal;
  }

  async createInvite(
    invite: Omit<WorkspaceInvite, 'id'>,
  ): Promise<WorkspaceInvite | null> {
    const raw = await this.modelWorkspaceInvite.create(invite);

    return raw ? WorkspaceInvite.build(raw) : null;
  }

  async create(workspace: any): Promise<Workspace> {
    const dbWorkspace = await this.modelWorkspace.create(workspace);
    return this.toDomain(dbWorkspace);
  }

  async findAllBy(where: Partial<WorkspaceAttributes>): Promise<Workspace[]> {
    const workspaces = await this.modelWorkspace.findAll({ where });
    return workspaces.map((workspace) => this.toDomain(workspace));
  }

  async findWorkspaceAndUser(
    userUuid: string,
    workspaceId: string,
  ): Promise<{
    workspace?: Workspace | null;
    workspaceUser?: WorkspaceUser | null;
  }> {
    const workspace = await this.modelWorkspace.findOne({
      where: { id: workspaceId },
      include: {
        model: WorkspaceUserModel,
        where: { memberId: userUuid },
        required: false,
      },
    });

    return {
      workspace: workspace ? this.toDomain(workspace) : null,
      workspaceUser: workspace?.workspaceUsers?.[0]
        ? this.workspaceUserToDomain(workspace.workspaceUsers[0])
        : null,
    };
  }

  async deactivateWorkspaceUser(
    memberId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.modelWorkspaceUser.update(
      { deactivated: true },
      { where: { memberId, workspaceId } },
    );
  }

  async findUserAvailableWorkspaces(userUuid: string) {
    const userWorkspaces = await this.modelWorkspaceUser.findAll({
      where: { memberId: userUuid },
      include: {
        model: WorkspaceModel,
        required: true,
      },
    });

    return userWorkspaces.map((userWorkspace) => ({
      workspaceUser: this.workspaceUserToDomain(userWorkspace),
      workspace: this.toDomain(userWorkspace.workspace),
    }));
  }

  async findWorkspaceUsers(
    workspaceId: WorkspaceAttributes['id'],
    search: string | null = null,
  ): Promise<WorkspaceUser[]> {
    const usersWorkspace = search
      ? await this.modelWorkspaceUser.findAll({
          where: {
            workspaceId,
            [Op.or]: [
              {
                '$member.name$': {
                  [Op.substring]: search,
                },
              },
              {
                '$member.lastname$': {
                  [Op.substring]: search,
                },
              },
              {
                '$member.email$': {
                  [Op.substring]: search,
                },
              },
            ],
          },
          include: [
            {
              model: UserModel,
              as: 'member',
            },
          ],
        })
      : await this.modelWorkspaceUser.findAll({
          where: { workspaceId },
          include: [UserModel],
        });

    return usersWorkspace.map((userWorkspace) =>
      this.workspaceUserToDomain(userWorkspace),
    );
  }

  async addUserToWorkspace(
    workspaceUser: Omit<WorkspaceUser, 'id'>,
    options?: { transaction?: Transaction },
  ): Promise<WorkspaceUser> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    const user = await this.modelWorkspaceUser.create(workspaceUser, {
      ...options,
      transaction: sequelizeTransaction,
    });
    return this.workspaceUserToDomain(user);
  }

  async findAllByWithPagination(
    where: any,
    limit = 20,
    offset = 0,
  ): Promise<Workspace[]> {
    const workspaces = await this.modelWorkspace.findAll({
      where,
      limit,
      offset,
    });
    return workspaces.map((workspace) => this.toDomain(workspace));
  }

  async updateById(
    id: WorkspaceAttributes['id'],
    update: Partial<WorkspaceAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelWorkspace.update(update, {
      where: { id },
      transaction: transaction?.getSequelizeTransaction(),
    });
  }

  async updateBy(
    where: Partial<WorkspaceAttributes>,
    update: Partial<WorkspaceAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelWorkspace.update(update, {
      where,
      transaction: transaction?.getSequelizeTransaction(),
    });
  }

  async deleteById(id: WorkspaceAttributes['id']): Promise<void> {
    await this.modelWorkspace.destroy({ where: { id } });
  }

  async updateWorkspaceUser(
    workspaceUserId: WorkspaceUserAttributes['id'],
    update: Partial<WorkspaceUserAttributes>,
  ): Promise<void> {
    await this.modelWorkspaceUser.update(update, {
      where: { id: workspaceUserId },
    });
  }

  async updateWorkspaceUserBy(
    where: Partial<WorkspaceUserAttributes>,
    update: Partial<WorkspaceUserAttributes>,
    options?: { transaction?: Transaction },
  ): Promise<void> {
    const sequelizeTransaction =
      options?.transaction instanceof SequelizeTransactionAdapter
        ? options.transaction.getSequelizeTransaction()
        : undefined;
    await this.modelWorkspaceUser.update(update, {
      where,
      ...options,
      transaction: sequelizeTransaction,
    });
  }

  toDomain(model: WorkspaceModel): Workspace {
    return Workspace.build({
      ...model.toJSON(),
    });
  }

  workspaceUserToDomain(model: WorkspaceUserModel): WorkspaceUser {
    return WorkspaceUser.build({
      ...model?.toJSON(),
      member: model.member ? User.build(model.member) : null,
    });
  }

  workspaceItemUserToDomain(model: WorkspaceItemUserModel): WorkspaceItemUser {
    return WorkspaceItemUser.build({
      ...model?.toJSON(),
    });
  }

  toModel(domain: Workspace): Partial<WorkspaceAttributes> {
    return domain?.toJSON();
  }
}
