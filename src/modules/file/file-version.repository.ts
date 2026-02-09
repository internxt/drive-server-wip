import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { FileVersionModel } from './file-version.model';
import {
  FileVersion,
  FileVersionAttributes,
  FileVersionStatus,
} from './file-version.domain';

export type CreateFileVersionData = Omit<
  FileVersionAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface FileVersionRepository {
  create(version: CreateFileVersionData): Promise<FileVersion>;
  upsert(version: CreateFileVersionData): Promise<FileVersion>;
  findAllByFileId(fileId: string): Promise<FileVersion[]>;
  findById(id: string): Promise<FileVersion | null>;
  updateStatus(id: string, status: FileVersionStatus): Promise<void>;
  updateStatusBatch(ids: string[], status: FileVersionStatus): Promise<void>;
  delete(id: string): Promise<void>;
  deleteAllByFileId(fileId: string): Promise<void>;
  deleteUserVersionsBatch(userId: string, limit: number): Promise<number>;
  deleteUserVersionsByLimits(
    userId: string,
    retentionDays: number,
    maxVersions: number,
    limit: number,
  ): Promise<number>;
  sumExistingSizesByUser(userId: string): Promise<number>;
  findExpiredVersionIdsByTierLimits(limit: number): Promise<string[]>;
}

@Injectable()
export class SequelizeFileVersionRepository implements FileVersionRepository {
  constructor(
    @InjectModel(FileVersionModel)
    private readonly model: typeof FileVersionModel,
  ) {}

  async create(version: CreateFileVersionData): Promise<FileVersion> {
    const createdVersion = await this.model.create({
      fileId: version.fileId,
      userId: version.userId,
      networkFileId: version.networkFileId,
      size: version.size,
      status: version.status || FileVersionStatus.EXISTS,
      sourceLastUpdatedAt: version.sourceLastUpdatedAt,
    });

    return FileVersion.build(createdVersion.toJSON());
  }

  async upsert(version: CreateFileVersionData): Promise<FileVersion> {
    const [instance] = await this.model.upsert(
      {
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status || FileVersionStatus.EXISTS,
        sourceLastUpdatedAt: version.sourceLastUpdatedAt,
        updatedAt: new Date(),
      },
      {
        conflictFields: ['file_id', 'network_file_id'],
      },
    );

    return FileVersion.build(instance.toJSON());
  }

  async findAllByFileId(fileId: string): Promise<FileVersion[]> {
    const versions = await this.model.findAll({
      where: {
        fileId,
        status: FileVersionStatus.EXISTS,
      },
      order: [['createdAt', 'DESC']],
    });

    return versions.map((v) => FileVersion.build(v.toJSON()));
  }

  async findById(id: string): Promise<FileVersion | null> {
    const version = await this.model.findByPk(id);

    if (!version) {
      return null;
    }

    return FileVersion.build(version.toJSON());
  }

  async updateStatus(id: string, status: FileVersionStatus): Promise<void> {
    await this.model.update(
      { status },
      {
        where: { id },
      },
    );
  }

  async updateStatusBatch(
    ids: string[],
    status: FileVersionStatus,
  ): Promise<void> {
    await this.model.update(
      { status },
      {
        where: { id: ids },
      },
    );
  }

  async delete(id: string): Promise<void> {
    await this.model.destroy({
      where: { id },
    });
  }

  async deleteAllByFileId(fileId: string): Promise<void> {
    await this.model.update(
      { status: FileVersionStatus.DELETED },
      {
        where: { fileId },
      },
    );
  }

  async deleteUserVersionsBatch(
    userId: string,
    limit: number,
  ): Promise<number> {
    const result = await this.model.sequelize.query(
      `
      UPDATE file_versions
      SET status = :deletedStatus, updated_at = NOW()
      WHERE id IN (
        SELECT id
        FROM file_versions
        WHERE user_id = :userId
          AND status = :existsStatus
        LIMIT :limit
      )
    `,
      {
        replacements: {
          userId,
          limit,
          deletedStatus: FileVersionStatus.DELETED,
          existsStatus: FileVersionStatus.EXISTS,
        },
        type: QueryTypes.UPDATE,
      },
    );

    return result[1];
  }

  async deleteUserVersionsByLimits(
    userId: string,
    retentionDays: number,
    maxVersions: number,
    limit: number,
  ): Promise<number> {
    const query = `
      WITH ranked_versions AS (
        SELECT
          fv.id as version_id,
          fv.file_id,
          fv.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY fv.file_id
            ORDER BY fv.created_at DESC
          ) as version_rank
        FROM file_versions fv
        WHERE fv.user_id = :userId
          AND fv.status = :existsStatus
      )
      UPDATE file_versions
      SET status = :deletedStatus, updated_at = NOW()
      WHERE id IN (
        SELECT version_id
        FROM ranked_versions
        WHERE
          (:maxVersions > 0 AND version_rank > :maxVersions)
          OR
          (:retentionDays > 0 AND created_at < NOW() - (:retentionDays || ' days')::INTERVAL)
        ORDER BY version_id ASC
        LIMIT :limit
      )
    `;

    const result = await this.model.sequelize.query(
      query,
      {
        replacements: {
          userId,
          retentionDays,
          maxVersions,
          limit,
          deletedStatus: FileVersionStatus.DELETED,
          existsStatus: FileVersionStatus.EXISTS,
        },
        type: QueryTypes.UPDATE,
      },
    );

    return result[1];
  }

  async sumExistingSizesByUser(userId: string): Promise<number> {
    const result = await this.model.findAll({
      attributes: [[Sequelize.fn('SUM', Sequelize.col('size')), 'total']],
      where: {
        userId,
        status: FileVersionStatus.EXISTS,
      },
      raw: true,
    });

    return Number(result[0]?.['total']) || 0;
  }

  async findExpiredVersionIdsByTierLimits(limit: number): Promise<string[]> {
    const query = `
      WITH retention_config AS (
        SELECT
          fv.id as version_id,
          fv.user_id,
          fv.created_at,
          COALESCE(
            (SELECT l.value::integer
             FROM user_overridden_limits uol
             JOIN limits l ON uol.limit_id = l.id
             WHERE uol.user_id = u.uuid AND l.label = 'file-version-retention-days'),
            (SELECT l.value::integer
             FROM tiers_limits tl
             JOIN limits l ON tl.limit_id = l.id
             WHERE tl.tier_id = u.tier_id AND l.label = 'file-version-retention-days'),
            0
          ) as retention_days
        FROM file_versions fv
        JOIN users u ON fv.user_id = u.uuid
        WHERE fv.status = 'EXISTS'
      )
      SELECT version_id
      FROM retention_config
      WHERE
        retention_days > 0
        AND created_at < NOW() - (retention_days || ' days')::INTERVAL
      ORDER BY version_id ASC
      LIMIT :limit
    `;

    const results = await this.model.sequelize.query<{ version_id: string }>(
      query,
      {
        replacements: { limit },
        type: QueryTypes.SELECT,
      },
    );

    return results.map((r) => r.version_id);
  }
}
