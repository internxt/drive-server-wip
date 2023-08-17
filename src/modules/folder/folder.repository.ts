import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOptions, Op } from 'sequelize';
import { v4 } from 'uuid';

import { Folder } from './folder.domain';
import { FolderAttributes } from './folder.attributes';

import { UserModel } from '../user/user.model';
import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { Pagination } from '../../lib/pagination';
import { FolderModel } from './folder.model';

type FindInTreeResponse = Pick<Folder, 'parentId' | 'id' | 'plainName'>;

export interface FolderRepository {
  findAll(): Promise<Array<Folder> | []>;
  findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []>;
  findById(
    folderId: FolderAttributes['id'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Folder | null>;
  findByUuid(
    folderUuid: FolderAttributes['uuid'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Folder | null>;
  findInTree(
    folderTreeRootId: FolderAttributes['parentId'],
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<FindInTreeResponse | null>;
  updateByFolderId(
    folderId: FolderAttributes['id'],
    update: Partial<Folder>,
  ): Promise<Folder>;
  updateManyByFolderId(
    folderIds: FolderAttributes['id'][],
    update: Partial<Folder>,
  ): Promise<void>;
  deleteById(folderId: FolderAttributes['id']): Promise<void>;
  clearOrphansFolders(userId: FolderAttributes['userId']): Promise<number>;
}

@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
    @InjectModel(UserModel)
    private userModel: typeof UserModel,
  ) {}

  async findAllCursor(
    where: Partial<Record<keyof FolderAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      limit,
      offset,
      where,
      order,
    });

    return folders.map(this.toDomain.bind(this));
  }

  async findAllCursorWithParent(
    where: Partial<Record<keyof FolderAttributes, any>>,
    limit: number,
    offset: number,
    order: Array<[keyof FolderModel, 'ASC' | 'DESC']> = [],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      include: [
        {
          model: FolderModel,
          as: 'parent',
          attributes: ['id', 'uuid'],
        },
      ],
      limit,
      offset,
      where,
      order,
    });

    return folders.map(this.toDomain.bind(this));
  }

  async findAll(where = {}): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({ where });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findByIds(user: User, ids: FolderAttributes['id'][]) {
    const folders = await this.folderModel.findAll({
      where: { id: { [Op.in]: ids }, userId: user.id },
    });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findAllByParentIdCursor(
    where: Partial<FolderAttributes>,
    limit: number,
    offset: number,
  ): Promise<Folder[]> {
    const folders = await this.folderModel.findAll({
      limit,
      offset,
      where,
      order: [['id', 'ASC']],
    });

    return folders.map(this.toDomain.bind(this));
  }

  async findByUuid(
    uuid: FolderAttributes['uuid'],
    deleted: FolderAttributes['deleted'] = false,
  ): Promise<Folder> {
    const folder = await this.folderModel.findOne({ where: { uuid, deleted } });
    return folder ? this.toDomain(folder) : null;
  }

  async findAllNotDeleted(
    where: Partial<Record<keyof FolderAttributes, any>>,
    limit: number,
    offset: number,
  ): Promise<Folder[]> {
    const folders = await this.folderModel.findAll({
      limit,
      offset,
      where: {
        ...where,
        removed: {
          [Op.eq]: false,
        },
      },
    });

    return folders.map(this.toDomain.bind(this));
  }

  async findOne(where: Partial<FolderAttributes>): Promise<Folder | null> {
    const folder = await this.folderModel.findOne({ where });

    return folder ? this.toDomain(folder) : null;
  }

  async findAllByParentIdAndUserId(
    parentId: FolderAttributes['parentId'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Array<Folder> | []> {
    const folders = await this.folderModel.findAll({
      where: { parentId, userId, deleted },
    });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findAllByParentId(
    parentId: FolderAttributes['parentId'],
    deleted: FolderAttributes['deleted'],
    page: number = null,
    perPage: number = null,
    order: [string, string][] = [['id', 'ASC']],
  ): Promise<Array<Folder> | []> {
    const query: FindOptions = {
      where: { parentId, deleted },
      order,
    };
    const { offset, limit } = Pagination.calculatePagination(page, perPage);
    if (page && perPage) {
      query.offset = offset;
      query.limit = limit;
    }
    const folders = await this.folderModel.findAll(query);
    return folders.map((folder) => this.toDomain(folder));
  }

  async findById(
    folderId: FolderAttributes['id'],
    deleted: FolderAttributes['deleted'] = false,
  ): Promise<Folder | null> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
        deleted,
      },
    });
    return folder ? this.toDomain(folder) : null;
  }

  async updateByFolderId(
    folderId: FolderAttributes['id'],
    update: Partial<Folder>,
  ): Promise<Folder> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });

    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    folder.set(update);
    await folder.save();
    return this.toDomain(folder);
  }

  async updateManyByFolderId(
    folderIds: FolderAttributes['id'][],
    update: Partial<Folder>,
  ): Promise<void> {
    await this.folderModel.update(update, {
      where: {
        id: {
          [Op.in]: folderIds,
        },
      },
    });
  }

  async create(
    userId: UserAttributes['id'],
    name: FolderAttributes['name'],
    bucket: FolderAttributes['bucket'],
    parentId: FolderAttributes['id'],
    encryptVersion: FolderAttributes['encryptVersion'],
  ): Promise<Folder> {
    const folder = await this.folderModel.create({
      userId,
      name,
      bucket,
      parentId,
      encryptVersion,
      uuid: v4(),
    });

    return this.toDomain(folder);
  }

  async bulkCreate(
    folders: {
      userId: UserAttributes['id'];
      name: FolderAttributes['name'];
      bucket: FolderAttributes['bucket'];
      parentId: FolderAttributes['id'];
      encryptVersion: FolderAttributes['encryptVersion'];
    }[],
  ): Promise<Folder[]> {
    const rawFolders = await this.folderModel.bulkCreate(folders);

    return rawFolders.map((f) => this.toDomain(f));
  }

  async deleteById(folderId: number): Promise<void> {
    await this.folderModel.destroy({
      where: {
        id: { [Op.eq]: folderId },
      },
    });
  }

  async clearOrphansFolders(
    userId: FolderAttributes['userId'],
  ): Promise<number> {
    const clear = await this.folderModel.sequelize.query(
      'CALL clear_orphan_folders_by_user (:userId, :output)',
      {
        replacements: { userId, output: null },
      },
    );

    return (clear[0][0] as any).total_left;
  }

  /**
   * Gets the number of folders given a condition
   * @param where Condition(s) to match
   * @returns The number of folders that match the condition
   */
  async getFoldersCountWhere(where: Partial<Folder>): Promise<number> {
    const { count } = await this.folderModel.findAndCountAll({ where });
    return count;
  }

  /**
   * Returns the number of folders whose parent id does not exist
   * @param userId User whose folders could be orphan
   * @returns Number of orphan folders
   */
  async getFoldersWhoseParentIdDoesNotExist(
    userId: FolderAttributes['userId'],
  ): Promise<number> {
    const { count } = await this.folderModel.findAndCountAll({
      where: {
        parentId: {
          [Op.not]: null,
          [Op.notIn]: this.folderModel.findAll({
            where: { userId },
          }),
        },
        userId,
      },
    });

    return count;
  }

  async findInTree(
    folderTreeRootId: number,
    folderId: number,
    userId: number,
    deleted: boolean,
  ): Promise<FindInTreeResponse | null> {
    const [[folder]] = await this.folderModel.sequelize.query(
      `
      WITH RECURSIVE rec AS (
        SELECT parent_id, id, plain_name
        FROM folders
        WHERE
            id = (:folderTreeRootId)
          AND
            deleted = (:deleted)
          AND
            user_id = (:userId)            
        UNION
        SELECT fo.parent_id, fo.id, fo.plain_name
        FROM folders fo
        INNER JOIN rec r ON r.id = fo.parent_id
        WHERE
            fo.user_id = (:userId)
          AND 
            fo.deleted = (:deleted)
      ) SELECT parent_id as parentId, id, plain_name as plainName FROM rec WHERE id = (:folderId)
    `,
      {
        replacements: { folderTreeRootId, folderId, userId, deleted },
      },
    );

    return folder as FindInTreeResponse;
  }

  async deleteByUser(user: User, folders: Folder[]): Promise<void> {
    await this.folderModel.update(
      {
        removed: true,
        removedAt: new Date(),
        deleted: true,
        deletedAt: new Date(),
      },
      {
        where: {
          userId: user.id,
          id: {
            [Op.in]: folders.map(({ id }) => id),
          },
        },
      },
    );
  }

  async findAllCursorWhereUpdatedAfter(
    where: Partial<Folder>,
    updatedAfter: Date,
    limit: number,
    offset: number,
    additionalOrders: Array<[keyof FolderModel, string]> = [],
  ): Promise<Array<Folder>> {
    const folders = await this.folderModel.findAll({
      where: {
        ...where,
        updatedAt: {
          [Op.gt]: updatedAfter,
        },
        parentId: {
          [Op.not]: null,
        },
      },
      order: additionalOrders,
      limit,
      offset,
    });

    return folders.map((folder) => this.toDomain(folder));
  }

  private toDomain(model: FolderModel): Folder {
    return Folder.build({
      ...model.toJSON(),
      parent: model.parent ? Folder.build(model.parent) : null,
      user: model.user ? User.build(model.user) : null,
    });
  }

  private toModel(domain: Folder): Partial<FolderAttributes> {
    return domain.toJSON();
  }
}
export { FolderModel };
