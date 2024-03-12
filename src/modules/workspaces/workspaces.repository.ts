import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOrCreateOptions, Transaction } from 'sequelize/types';

import { WorkspaceModel } from './models/workspace.model';
import { Workspace } from './workspaces.domain';
import { WorkspaceAttributes } from './attributes/workspace.attributes';

export interface WorkspaceRepository {
  findById(id: number): Promise<Workspace | null>;
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
  ) {}
  async findById(id: number): Promise<Workspace | null> {
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

  async create(workspace: any): Promise<Workspace> {
    const dbWorkspace = await this.modelWorkspace.create(workspace);
    return this.toDomain(dbWorkspace);
  }

  async findAllBy(where: any): Promise<Array<Workspace> | []> {
    const workspaces = await this.modelWorkspace.findAll({ where });
    return workspaces.map((workspace) => this.toDomain(workspace));
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

  toModel(domain: Workspace): Partial<WorkspaceAttributes> {
    return domain.toJSON();
  }
}
export { WorkspaceModel };
