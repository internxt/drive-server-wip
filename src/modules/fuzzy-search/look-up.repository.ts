import { Injectable } from '@nestjs/common';
import { type ItemType } from './look-up.domain';
import { InjectConnection } from '@nestjs/sequelize';
import { type UserAttributes } from '../user/user.attributes';
import { QueryTypes, Sequelize } from 'sequelize';
import { type WorkspaceAttributes } from '../workspaces/attributes/workspace.attributes';

type LookUpResult = Array<{
  id: string;
  itemId: string;
  itemType: ItemType;
  userId: string;
  name: string;
  rank: number | null;
  similarity: number;
  item?: Record<string, unknown>;
}>;

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult>;
  workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUserUuid: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    offset: number,
  ): Promise<LookUpResult>;
}

function toResult(rows: Record<string, unknown>[]): LookUpResult {
  return rows.map((row) => ({
    id: row.id as string,
    itemId: row.itemId as string,
    itemType: row.itemType as ItemType,
    userId: String(row.userId),
    name: row.name as string,
    rank: (row.rank as number) ?? null,
    similarity: row.similarity as number,
    item:
      row.itemType === 'file'
        ? {
            type: row['file.type'],
            id: row['file.id'],
            size: row['file.size'],
            bucket: row['file.bucket'],
            fileId: row['file.fileId'],
            plainName: row['file.plainName'],
          }
        : { id: row['folder.id'] },
  }));
}

@Injectable()
export class SequelizeLookUpRepository implements LookUpRepository {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  async search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    offset = 0,
  ): Promise<LookUpResult> {
    const rows = await this.sequelize.query<Record<string, unknown>>(
      `
      SELECT
          f."uuid"                                                              AS "id",
          f."uuid"                                                              AS "itemId",
          'file'                                                                AS "itemType",
          :userUuid                                                             AS "userId",
          f."plain_name"                                                        AS "name",
          NULL                                                                  AS "rank",
          similarity(f."plain_name", :partialName)                             AS "similarity",
          CASE WHEN f."plain_name" = :partialName THEN 1 ELSE 0 END            AS "exactMatch",
          f."type"        AS "file.type",
          f."id"          AS "file.id",
          f."size"        AS "file.size",
          f."bucket"      AS "file.bucket",
          f."file_id"     AS "file.fileId",
          f."plain_name"  AS "file.plainName",
          NULL            AS "folder.id"
      FROM files f
      WHERE f."user_id" = (SELECT id FROM users WHERE uuid = :userUuid)
        AND f."status" = 'EXISTS'
        AND (f."plain_name" % :partialName OR similarity(f."plain_name", :partialName) > 0.0)

      UNION ALL

      SELECT
          fo."uuid"                                                             AS "id",
          fo."uuid"                                                             AS "itemId",
          'folder'                                                              AS "itemType",
          :userUuid                                                             AS "userId",
          fo."plain_name"                                                       AS "name",
          NULL                                                                  AS "rank",
          similarity(fo."plain_name", :partialName)                            AS "similarity",
          CASE WHEN fo."plain_name" = :partialName THEN 1 ELSE 0 END           AS "exactMatch",
          NULL AS "file.type",
          NULL AS "file.id",
          NULL AS "file.size",
          NULL AS "file.bucket",
          NULL AS "file.fileId",
          NULL AS "file.plainName",
          fo."id" AS "folder.id"
      FROM folders fo
      WHERE fo."user_id" = (SELECT id FROM users WHERE uuid = :userUuid)
        AND NOT fo."deleted"
        AND NOT fo."removed"
        AND fo."parent_uuid" IS NOT NULL
        AND (fo."plain_name" % :partialName OR similarity(fo."plain_name", :partialName) > 0.0)

      ORDER BY "exactMatch" DESC, "similarity" DESC
      LIMIT 10 OFFSET :offset
      `,
      {
        replacements: { userUuid, partialName, offset },
        type: QueryTypes.SELECT,
      },
    );

    return toResult(rows);
  }

  async workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUserUuid: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    offset = 0,
  ): Promise<LookUpResult> {
    const rows = await this.sequelize.query<Record<string, unknown>>(
      `
      SELECT
          f."uuid"                                                              AS "id",
          f."uuid"                                                              AS "itemId",
          'file'                                                                AS "itemType",
          :userUuid                                                             AS "userId",
          f."plain_name"                                                        AS "name",
          NULL                                                                  AS "rank",
          similarity(f."plain_name", :partialName)                             AS "similarity",
          CASE WHEN f."plain_name" = :partialName THEN 1 ELSE 0 END            AS "exactMatch",
          f."type"        AS "file.type",
          f."id"          AS "file.id",
          f."size"        AS "file.size",
          f."bucket"      AS "file.bucket",
          f."file_id"     AS "file.fileId",
          f."plain_name"  AS "file.plainName",
          NULL            AS "folder.id"
      FROM files f
      INNER JOIN workspace_items_users wiu ON wiu.item_id = f.uuid
      WHERE f."user_id" = (SELECT id FROM users WHERE uuid = :workspaceUserUuid)
        AND f."status" = 'EXISTS'
        AND wiu.created_by = :userUuid
        AND wiu.workspace_id = :workspaceId
        AND (f."plain_name" % :partialName OR similarity(f."plain_name", :partialName) > 0.0)

      UNION ALL

      SELECT
          fo."uuid"                                                             AS "id",
          fo."uuid"                                                             AS "itemId",
          'folder'                                                              AS "itemType",
          :userUuid                                                             AS "userId",
          fo."plain_name"                                                       AS "name",
          NULL                                                                  AS "rank",
          similarity(fo."plain_name", :partialName)                            AS "similarity",
          CASE WHEN fo."plain_name" = :partialName THEN 1 ELSE 0 END           AS "exactMatch",
          NULL AS "file.type",
          NULL AS "file.id",
          NULL AS "file.size",
          NULL AS "file.bucket",
          NULL AS "file.fileId",
          NULL AS "file.plainName",
          fo."id" AS "folder.id"
      FROM folders fo
      INNER JOIN workspace_items_users wiu ON wiu.item_id = fo.uuid
      WHERE fo."user_id" = (SELECT id FROM users WHERE uuid = :workspaceUserUuid)
        AND NOT fo."deleted"
        AND NOT fo."removed"
        AND fo."parent_uuid" IS NOT NULL
        AND wiu.created_by = :userUuid
        AND wiu.workspace_id = :workspaceId
        AND (fo."plain_name" % :partialName OR similarity(fo."plain_name", :partialName) > 0.0)

      ORDER BY "exactMatch" DESC, "similarity" DESC
      LIMIT 10 OFFSET :offset
      `,
      {
        replacements: {
          userUuid,
          workspaceUserUuid,
          workspaceId,
          partialName,
          offset,
        },
        type: QueryTypes.SELECT,
      },
    );

    return toResult(rows);
  }
}
