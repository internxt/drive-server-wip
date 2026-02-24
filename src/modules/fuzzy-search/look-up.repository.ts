import { Injectable } from '@nestjs/common';
import { type ItemType, type LookUp } from './look-up.domain';
import { InjectModel } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { type UserAttributes } from '../user/user.attributes';
import { Op, Sequelize } from 'sequelize';
import { FolderModel } from '../folder/folder.model';
import { FileModel } from '../file/file.model';
import { type WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';

type LookUpResult = Array<{
  id: string;
  itemId: string;
  itemType: ItemType;
  userId: string;
  name: string;
  rank: number | null;
  similarity: number;
}>;

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult>;
  workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUser: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult>;
  instert(entry: LookUp): Promise<void>;
}

@Injectable()
export class SequelizeLookUpRepository implements LookUpRepository {
  constructor(
    @InjectModel(LookUpModel)
    private readonly model: typeof LookUpModel,
  ) {}

  private transformResult(result: LookUpModel[]): LookUpResult {
    return result.map((index) => {
      const raw = index.toJSON();
      const base = {
        id: raw.id,
        itemId: raw.itemId,
        itemType: raw.itemType,
        userId: raw.userId,
        name: raw.name,
        rank: raw.rank,
        similarity: raw.similarity,
      };
      if (raw.file) {
        return { ...base, item: raw.file };
      } else if (raw.folder) {
        return { ...base, item: raw.folder };
      } else {
        return { ...base };
      }
    });
  }

  async search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset = 0,
  ): Promise<LookUpResult> {
    const partialNameFormatted = partialName.replace(/\s+/g, ' & ');

    const result = await this.model.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(
              'nullif(ts_rank("tokenized_name", to_tsquery(:partialNameFormatted)), 1)',
            ),
            'rank',
          ],
          [
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            'similarity',
          ],
          [
            Sequelize.literal(
              `CASE WHEN "LookUpModel"."name" = :partialName THEN 1 ELSE 0 END`,
            ),
            'exactMatch',
          ],
        ],
      },
      where: {
        user_id: userUuid,
        [Op.or]: [
          Sequelize.literal(
            `to_tsquery(:partialNameFormatted) @@ "tokenized_name"`,
          ),
          Sequelize.where(
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            { [Op.gt]: 0.0 },
          ),
        ],
      },
      order: [
        [Sequelize.literal('"exactMatch"'), 'DESC'], // Prioritize exact matches
        [Sequelize.literal('"rank"'), 'DESC'],
        [Sequelize.literal('"similarity"'), 'DESC'],
      ],
      limit: 10,
      offset: offset,
      replacements: { partialName, partialNameFormatted, userUuid },
      include: [
        {
          model: FileModel,
          attributes: ['type', 'id', 'size', 'bucket', 'fileId', 'plainName'],
          as: 'file',
        },
        {
          model: FolderModel,
          attributes: ['id'],
          as: 'folder',
        },
      ],
    });

    return this.transformResult(result);
  }

  async workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUser: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult> {
    const partialNameFormatted = partialName.replace(/\s+/g, ' & ');

    const result = await this.model.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(
              'nullif(ts_rank("tokenized_name", to_tsquery(:partialNameFormatted)), 1)',
            ),
            'rank',
          ],
          [
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            'similarity',
          ],
          [
            Sequelize.literal(
              `CASE WHEN "LookUpModel"."name" = :partialName THEN 1 ELSE 0 END`,
            ),
            'exactMatch',
          ],
        ],
      },
      where: {
        user_id: workspaceUser,
        [Op.or]: [
          Sequelize.literal(
            `to_tsquery(:partialNameFormatted) @@ "tokenized_name"`,
          ),
          Sequelize.where(
            Sequelize.fn(
              'similarity',
              Sequelize.col('LookUpModel.name'),
              partialName,
            ),
            { [Op.gt]: 0.0 },
          ),
        ],
        [Op.and]: [
          Sequelize.literal(`"workspaceItemUser"."created_by" = :userUuid`),
          Sequelize.literal(
            `"workspaceItemUser"."workspace_id" = :workspaceId`,
          ),
        ],
      },
      order: [
        [Sequelize.literal('"exactMatch"'), 'DESC'], // Prioritize exact matches
        [Sequelize.literal('"rank"'), 'DESC'],
        [Sequelize.literal('"similarity"'), 'DESC'],
      ],
      limit: 10,
      offset: offset,
      replacements: {
        partialName,
        partialNameFormatted,
        userUuid,
        workspaceUser,
        workspaceId,
      },
      include: [
        {
          model: FileModel,
          attributes: ['type', 'id', 'size', 'bucket', 'fileId', 'plainName'],
          as: 'file',
        },
        {
          model: FolderModel,
          attributes: ['id'],
          as: 'folder',
        },
        {
          model: WorkspaceItemUserModel,
          attributes: [],
          as: 'workspaceItemUser', // Corrected alias
          required: true,
          on: {
            col1: Sequelize.where(
              Sequelize.col('LookUpModel.item_id'),
              '=',
              Sequelize.col('workspaceItemUser.item_id'),
            ),
          },
        },
      ],
    });
    return this.transformResult(result);
  }
  async instert(entry: LookUp): Promise<void> {
    await this.model.create({
      id: entry.itemId,
      name: entry.name,
      userUuid: entry.userId,
    });
  }
}
