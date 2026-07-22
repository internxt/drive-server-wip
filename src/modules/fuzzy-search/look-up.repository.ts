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

export interface FuzzySearchFilters {
  offset?: number;
  itemTypes?: ItemType[];
  extensions?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

export interface LookUpRepository {
  search(
    userUuid: UserAttributes['uuid'],
    partialName: string,
    filters?: FuzzySearchFilters,
  ): Promise<LookUpResult>;
  workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUserUuid: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    filters?: FuzzySearchFilters,
  ): Promise<LookUpResult>;
}

interface FilterClauses {
  includeFiles: boolean;
  includeFolders: boolean;
  fileWhere: string;
  folderWhere: string;
  replacements: Record<string, unknown>;
}

function buildFilterClauses(filters: FuzzySearchFilters): FilterClauses {
  const includeFiles = !filters.itemTypes || filters.itemTypes.includes('file');
  const includeFolders =
    (!filters.itemTypes || filters.itemTypes.includes('folder')) &&
    filters.minSize === undefined &&
    filters.maxSize === undefined;

  const fileClauses: string[] = [];
  const folderClauses: string[] = [];
  const replacements: Record<string, unknown> = {};

  if (filters.extensions?.length) {
    fileClauses.push('AND LOWER(f."type") IN (:extensions)');
    replacements.extensions = filters.extensions;
  }
  if (filters.minSize !== undefined) {
    fileClauses.push('AND f."size" >= :minSize');
    replacements.minSize = filters.minSize;
  }
  if (filters.maxSize !== undefined) {
    fileClauses.push('AND f."size" <= :maxSize');
    replacements.maxSize = filters.maxSize;
  }
  if (filters.modifiedAfter !== undefined) {
    fileClauses.push('AND f."modification_time" >= :modifiedAfter');
    folderClauses.push('AND fo."modification_time" >= :modifiedAfter');
    replacements.modifiedAfter = filters.modifiedAfter;
  }
  if (filters.modifiedBefore !== undefined) {
    fileClauses.push('AND f."modification_time" <= :modifiedBefore');
    folderClauses.push('AND fo."modification_time" <= :modifiedBefore');
    replacements.modifiedBefore = filters.modifiedBefore;
  }

  return {
    includeFiles,
    includeFolders,
    fileWhere: fileClauses.join('\n        '),
    folderWhere: folderClauses.join('\n        '),
    replacements,
  };
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
    filters: FuzzySearchFilters = {},
  ): Promise<LookUpResult> {
    const clauses = buildFilterClauses(filters);

    const filesSelect = `
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
        ${clauses.fileWhere}
      `;

    const foldersSelect = `
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
        ${clauses.folderWhere}
      `;

    return this.runSearch(clauses, filesSelect, foldersSelect, {
      userUuid,
      partialName,
      offset: filters.offset ?? 0,
    });
  }

  async workspaceSearch(
    userUuid: UserAttributes['uuid'],
    workspaceUserUuid: WorkspaceAttributes['workspaceUserId'],
    workspaceId: WorkspaceAttributes['id'],
    partialName: string,
    filters: FuzzySearchFilters = {},
  ): Promise<LookUpResult> {
    const clauses = buildFilterClauses(filters);

    const filesSelect = `
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
        ${clauses.fileWhere}
      `;

    const foldersSelect = `
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
        ${clauses.folderWhere}
      `;

    return this.runSearch(clauses, filesSelect, foldersSelect, {
      userUuid,
      workspaceUserUuid,
      workspaceId,
      partialName,
      offset: filters.offset ?? 0,
    });
  }

  private async runSearch(
    clauses: FilterClauses,
    filesSelect: string,
    foldersSelect: string,
    baseReplacements: Record<string, unknown>,
  ): Promise<LookUpResult> {
    const selects = [
      ...(clauses.includeFiles ? [filesSelect] : []),
      ...(clauses.includeFolders ? [foldersSelect] : []),
    ];

    if (selects.length === 0) {
      return [];
    }

    const rows = await this.sequelize.query<Record<string, unknown>>(
      `
      ${selects.join('\n      UNION ALL\n')}
      ORDER BY "exactMatch" DESC, "similarity" DESC
      LIMIT 10 OFFSET :offset
      `,
      {
        replacements: { ...baseReplacements, ...clauses.replacements },
        type: QueryTypes.SELECT,
      },
    );

    return toResult(rows);
  }
}
