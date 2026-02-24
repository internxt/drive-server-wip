import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { type FindOrCreateOptions, type Transaction } from 'sequelize/types';
import { type WorkspaceAttributes } from '../attributes/workspace.attributes';
import { Workspace } from '../domains/workspaces.domain';
import { WorkspaceModel } from '../models/workspace.model';
import { WorkspaceUserModel } from '../models/workspace-users.model';
import { WorkspaceUser } from '../domains/workspace-user.domain';
import { WorkspaceInviteModel } from '../models/workspace-invite.model';
import { WorkspaceInvite } from '../domains/workspace-invite.domain';
import { type WorkspaceInviteAttributes } from '../attributes/workspace-invite.attribute';
import { type WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';
import { Op, Sequelize } from 'sequelize';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import {
  WorkspaceItemType,
  type WorkspaceItemUserAttributes,
} from '../attributes/workspace-items-users.attributes';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { FileModel } from '../../file/file.model';
import { File, type FileAttributes } from '../../file/file.domain';
import { Folder, type FolderAttributes } from '../../folder/folder.domain';
import { FolderModel } from '../../folder/folder.model';
import {
  type WorkspaceLogAttributes,
  WorkspaceLogType,
} from '../attributes/workspace-logs.attributes';
import { WorkspaceLogModel } from '../models/workspace-logs.model';
import { WorkspaceLog } from '../domains/workspace-log.domain';

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
    @InjectModel(WorkspaceLogModel)
    private readonly modelWorkspaceLog: typeof WorkspaceLogModel,
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

  async findWorkspaceUsersOfOwnedWorkspaces(
    ownerId: Workspace['ownerId'],
  ): Promise<{ workspace: Workspace; workspaceUser: WorkspaceUser }[]> {
    const workspacesAndUsers = await this.modelWorkspaceUser.findAll({
      where: { memberId: ownerId },
      include: {
        model: WorkspaceModel,
        as: 'workspace',
        required: true,
        where: {
          ownerId,
        },
      },
    });

    return workspacesAndUsers.map((workspaceAndUser) => ({
      workspace: this.toDomain(workspaceAndUser.workspace),
      workspaceUser: this.workspaceUserToDomain(workspaceAndUser),
    }));
  }

  createTransaction(): Promise<Transaction> {
    return this.modelWorkspace.sequelize.transaction();
  }

  findOrCreate(
    opts: FindOrCreateOptions,
  ): Promise<[Workspace | null, boolean]> {
    return this.modelWorkspace.findOrCreate(opts) as any;
  }

  async findOne(
    where: Partial<WorkspaceAttributes>,
  ): Promise<Workspace | null> {
    const workspace = await this.modelWorkspace.findOne({ where });

    return workspace ? this.toDomain(workspace) : null;
  }

  async findInvite(
    where: Partial<WorkspaceInviteAttributes>,
  ): Promise<WorkspaceInvite | null> {
    const invite = await this.modelWorkspaceInvite.findOne({ where });

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
  ): Promise<void> {
    await this.modelWorkspaceInvite.destroy({ where });
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
  ): Promise<WorkspaceUser> {
    const workspaceUser = await this.modelWorkspaceUser.findOne({
      where,
      include: includeUser ? [{ model: UserModel, as: 'member' }] : [],
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
  ): Promise<WorkspaceItemUser | null> {
    const newItem = await this.modelWorkspaceItemUser.create(item);

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

  async findWorkspaceUsersByUserUuid(
    userUuid: string,
  ): Promise<WorkspaceUser[]> {
    const workspaceUsers = await this.modelWorkspaceUser.findAll({
      where: { memberId: userUuid },
    });
    return workspaceUsers.map((user) => this.workspaceUserToDomain(user));
  }

  async deleteUsersFromWorkspace(
    workspaceId: WorkspaceUser['id'],
    memberIds: WorkspaceUser['memberId'][],
  ): Promise<void> {
    await this.modelWorkspaceUser.destroy({
      where: { memberId: { [Op.in]: memberIds }, workspaceId },
    });
  }

  async deleteAllInvitationsByWorkspace(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<void> {
    await this.modelWorkspaceInvite.destroy({
      where: { workspaceId },
    });
  }

  async deleteAllInvitationByUser(
    userUUid: WorkspaceInviteAttributes['invitedUser'],
  ): Promise<void> {
    await this.modelWorkspaceInvite.destroy<WorkspaceInviteModel>({
      where: { invitedUser: userUUid },
    });
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
  ): Promise<WorkspaceUser> {
    const user = await this.modelWorkspaceUser.create(workspaceUser);
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
    await this.modelWorkspace.update(update, { where: { id }, transaction });
  }

  async updateBy(
    where: Partial<WorkspaceAttributes>,
    update: Partial<WorkspaceAttributes>,
    transaction?: Transaction,
  ): Promise<void> {
    await this.modelWorkspace.update(update, { where, transaction });
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

  async updateWorkspaceUserEncryptedKeyByMemberId(
    memberId: WorkspaceUserAttributes['memberId'],
    workspaceId: WorkspaceUserAttributes['workspaceId'],
    encryptedKey: WorkspaceUserAttributes['key'],
  ): Promise<void> {
    await this.modelWorkspaceUser.update(
      { key: encryptedKey },
      {
        where: { memberId, workspaceId },
      },
    );
  }

  async updateWorkspaceUserBy(
    where: Partial<WorkspaceUserAttributes>,
    update: Partial<WorkspaceUserAttributes>,
  ): Promise<void> {
    await this.modelWorkspaceUser.update(update, {
      where,
    });
  }

  async registerLog(log: Omit<WorkspaceLogAttributes, 'id'>): Promise<void> {
    await this.modelWorkspaceLog.create(log);
  }

  async accessLogs(
    workspaceId: Workspace['id'],
    summary: boolean = false,
    membersUuids?: WorkspaceLog['creator'][],
    logType?: WorkspaceLog['type'][],
    pagination?: {
      limit?: number;
      offset?: number;
    },
    lastDays?: number,
    order: [string, string][] = [['updatedAt', 'DESC']],
  ) {
    const dateLimit = new Date();
    if (lastDays) {
      dateLimit.setDate(dateLimit.getDate() - lastDays);
      dateLimit.setMilliseconds(0);
    }

    const whereConditions: any = {
      workspaceId,
      ...(lastDays && dateLimit ? { updatedAt: { [Op.gte]: dateLimit } } : {}),
    };

    if (membersUuids) {
      whereConditions.creator = { [Op.in]: membersUuids };
    }

    if (logType && logType.length > 0) {
      whereConditions.type = { [Op.in]: logType };
    }

    const itemLogs = await this.modelWorkspaceLog.findAll({
      where: whereConditions,
      include: [
        {
          model: UserModel,
          as: 'user',
          required: true,
        },
        {
          model: WorkspaceModel,
          as: 'workspace',
          required: true,
        },
        {
          model: FileModel,
          as: 'file',
          required: false,
          where: {
            uuid: {
              [Op.eq]: Sequelize.col('WorkspaceLogModel.entity_id'),
            },
          },
          on: {
            [Op.and]: [
              Sequelize.where(Sequelize.col('WorkspaceLogModel.type'), {
                [Op.or]: [
                  WorkspaceLogType.ShareFile,
                  WorkspaceLogType.DeleteFile,
                ],
              }),
              Sequelize.where(
                Sequelize.col('file.uuid'),
                Sequelize.col('WorkspaceLogModel.entity_id'),
              ),
            ],
          },
        },
        {
          model: FolderModel,
          as: 'folder',
          required: false,
          where: {
            uuid: {
              [Op.eq]: Sequelize.col('WorkspaceLogModel.entity_id'),
            },
          },
          on: {
            [Op.and]: [
              Sequelize.where(Sequelize.col('WorkspaceLogModel.type'), {
                [Op.or]: [
                  WorkspaceLogType.ShareFolder,
                  WorkspaceLogType.DeleteFolder,
                ],
              }),
              Sequelize.where(
                Sequelize.col('folder.uuid'),
                Sequelize.col('WorkspaceLogModel.entity_id'),
              ),
            ],
          },
        },
      ],
      ...pagination,
      order,
    });

    return itemLogs.map((item) =>
      summary
        ? this.workspaceLogToDomainSummary(item)
        : this.workspaceLogToDomain(item),
    );
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

  workspaceLogToDomain(model: WorkspaceLogModel): WorkspaceLog {
    return WorkspaceLog.build({
      ...model.toJSON(),
      user: model.user ? User.build(model.user).toJSON() : null,
      workspace: model.workspace
        ? Workspace.build(model.workspace).toJSON()
        : null,
      file: model.file ? File.build(model.file).toJSON() : null,
      folder: model.folder ? Folder.build(model.folder).toJSON() : null,
    });
  }

  workspaceLogToDomainSummary(model: WorkspaceLogModel): WorkspaceLog {
    const buildUser = ({ id, name, lastname, email, uuid }: UserModel) => ({
      id,
      name,
      lastname,
      email,
      uuid,
    });

    const buildWorkspace = ({ id, name }: WorkspaceModel) => ({ id, name });

    const buildFile = ({ uuid, plainName, folderUuid, type }: FileModel) => ({
      uuid,
      plainName,
      folderUuid,
      type,
    });

    const buildFolder = ({ uuid, plainName, parentId }: FolderModel) => ({
      uuid,
      plainName,
      parentId,
    });

    return WorkspaceLog.build({
      ...model.toJSON(),
      user: model.user ? buildUser(model.user) : null,
      workspace: model.workspace ? buildWorkspace(model.workspace) : null,
      file: model.file ? buildFile(model.file) : null,
      folder: model.folder ? buildFolder(model.folder) : null,
    });
  }

  toModel(domain: Workspace): Partial<WorkspaceAttributes> {
    return domain?.toJSON();
  }
}
