import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindOptions, Op } from 'sequelize';
import { v4 } from 'uuid';

import { Folder } from './folder.domain';
import { FolderAttributes } from './folder.attributes';

import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { Pagination } from '../../lib/pagination';
import { FolderModel } from './folder.model';
import { SharingModel } from '../sharing/models';
import { CalculateFolderSizeTimeoutException } from './exception/calculate-folder-size-timeout.exception';

function mapSnakeCaseToCamelCase(data) {
  const camelCasedObject = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) =>
        letter.toUpperCase(),
      );
      camelCasedObject[camelCaseKey] = data[key];
    }
  }
  return camelCasedObject;
}

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
  findByNameAndParentUuid(
    name: FolderAttributes['name'],
    parentUuid: FolderAttributes['parentUuid'],
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
  calculateFolderSize(folderUuid: string): Promise<number>;
}

@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(FolderModel)
    private folderModel: typeof FolderModel,
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
      include: [
        {
          model: SharingModel,
          attributes: ['type', 'id'],
          required: false,
        },
      ],
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
          where: {
            deleted: false,
            removed: false,
          },
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

  async findByUuids(uuids: FolderAttributes['uuid'][]): Promise<Folder[]> {
    const folders = await this.folderModel.findAll({
      where: { uuid: { [Op.in]: uuids } },
    });
    return folders.map((folder) => this.toDomain(folder));
  }

  async findUserFoldersByUuid(user: User, uuids: FolderAttributes['uuid'][]) {
    const folders = await this.folderModel.findAll({
      where: { uuid: { [Op.in]: uuids }, userId: user.id },
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

  async findByNameAndParentUuid(
    name: FolderAttributes['name'],
    parentUuid: FolderAttributes['parentUuid'],
    deleted: FolderAttributes['deleted'],
  ): Promise<Folder> {
    const folder = await this.folderModel.findOne({
      where: {
        name: { [Op.eq]: name },
        parentUuid: { [Op.eq]: parentUuid },
        deleted: { [Op.eq]: deleted },
      },
    });
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

  async getFolderAncestors(
    user: User,
    folderUuid: Folder['uuid'],
  ): Promise<Folder[]> {
    const [rawFolders] = await this.folderModel.sequelize.query(
      'SELECT * FROM get_folder_ancestors(:folder_id, :user_id)',
      {
        replacements: { folder_id: folderUuid, user_id: user.id },
      },
    );

    const camelCasedFolders = rawFolders.map(mapSnakeCaseToCamelCase);
    const folders = this.folderModel
      .bulkBuild(camelCasedFolders as any)
      .map((folder) => this.toDomain(folder));

    return folders;
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

  async calculateFolderSize(folderUuid: string): Promise<number> {
    try {
      const calculateSizeQuery = `
      WITH RECURSIVE folder_recursive AS (
        SELECT 
            fl1.uuid,
            fl1.parent_uuid,
            f1.size AS filesize,
            1 AS row_num,
            fl1.user_id as owner_id
        FROM folders fl1
        LEFT JOIN files f1 ON f1.folder_uuid = fl1.uuid
        WHERE fl1.uuid = :folderUuid
        AND fl1.removed = FALSE 
        AND fl1.deleted = FALSE
        AND f1.status != 'DELETED'
        
        UNION ALL
        
        SELECT 
            fl2.uuid,
            fl2.parent_uuid,
            f2.size AS filesize,
            fr.row_num + 1,
            fr.owner_id
        FROM folders fl2
        INNER JOIN files f2 ON f2.folder_uuid = fl2.uuid
        INNER JOIN folder_recursive fr ON fr.uuid = fl2.parent_uuid
        WHERE fr.row_num < 100000
        AND fl2.user_id = fr.owner_id
        AND fl2.removed = FALSE 
        AND fl2.deleted = FALSE
        AND f2.status != 'DELETED'
    ) 
    SELECT COALESCE(SUM(filesize), 0) AS totalsize FROM folder_recursive;
      `;

      const [[{ totalsize }]]: any = await FolderModel.sequelize.query(
        calculateSizeQuery,
        {
          replacements: {
            folderUuid,
          },
        },
      );

      return +totalsize;
    } catch (error) {
      if (error.original?.code === '57014') {
        throw new CalculateFolderSizeTimeoutException();
      }

      throw error;
    }
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
