import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOrCreateOptions, Transaction } from 'sequelize/types';
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

export interface WorkspaceRepository {
  findById(id: WorkspaceAttributes['id']): Promise<Workspace | null>;
  findByOwner(ownerId: Workspace['ownerId']): Promise<Workspace[]>;
  createTransaction(): Promise<Transaction>;
  findOrCreate(opts: FindOrCreateOptions): Promise<[Workspace | null, boolean]>;
  create(workspace: any): Promise<Workspace>;
  findAllBy(where: any): Promise<Array<Workspace> | []>;
  findAllByWithPagination(
    where: any,
    limit?: number,
    offset?: number,
  ): Promise<Workspace[]>;
  findOne(where: Partial<WorkspaceAttributes>): Promise<Workspace | null>;
  findInvite(
    where: Partial<WorkspaceInviteAttributes>,
  ): Promise<WorkspaceInvite | null>;
  updateById(
    id: WorkspaceAttributes['id'],
    update: Partial<WorkspaceAttributes>,
    transaction?: Transaction,
  ): Promise<void>;
  updateBy(
    where: Partial<WorkspaceAttributes>,
    update: Partial<WorkspaceAttributes>,
    transaction?: Transaction,
  ): Promise<void>;
}

@Injectable()
export class SequelizeWorkspaceRepository implements WorkspaceRepository {
  constructor(
    @InjectModel(WorkspaceModel)
    private modelWorkspace: typeof WorkspaceModel,
    @InjectModel(WorkspaceUserModel)
    private modelWorkspaceUser: typeof WorkspaceUserModel,
    @InjectModel(WorkspaceInviteModel)
    private modelWorkspaceInvite: typeof WorkspaceInviteModel,
  ) {}
  async findById(id: WorkspaceAttributes['id']): Promise<Workspace | null> {
    const workspace = await this.modelWorkspace.findByPk(id);
    return workspace ? this.toDomain(workspace) : null;
  }
  async findByOwner(ownerId: Workspace['ownerId']): Promise<Workspace[]> {
    const workspaces = await this.modelWorkspace.findAll({
      where: { ownerId },
    });
    return workspaces.map((workspace) => this.toDomain(workspace));
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
  ): Promise<WorkspaceInvite[]> {
    const invites = await this.modelWorkspaceInvite.findAll({ where });

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
  ): Promise<WorkspaceUser> {
    const workspaceUser = await this.modelWorkspaceUser.findOne({
      where,
    });

    return workspaceUser ? this.workspaceUserToDomain(workspaceUser) : null;
  }

  async deleteWorkspaceInviteById(
    inviteId: WorkspaceInviteAttributes['id'],
  ): Promise<void> {
    await this.modelWorkspaceInvite.destroy({ where: { id: inviteId } });
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
  ): Promise<bigint> {
    const totalSpaceLimit = await this.modelWorkspaceInvite.sum('spaceLimit', {
      where: { workspaceId: workspaceId },
    });

    return BigInt(totalSpaceLimit || 0);
  }

  async getTotalSpaceLimitInWorkspaceUsers(
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<bigint> {
    const total = await this.modelWorkspaceUser.sum('spaceLimit', {
      where: { workspaceId },
    });
    return BigInt(total ?? 0);
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
    workspace: Workspace | null;
    workspaceUser: WorkspaceUser | null;
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
  ): Promise<WorkspaceUser[]> {
    const usersWorkspace = await this.modelWorkspaceUser.findAll({
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

  toModel(domain: Workspace): Partial<WorkspaceAttributes> {
    return domain?.toJSON();
  }
}
