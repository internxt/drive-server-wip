import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
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
  deleteAllByFileId(fileId: string): Promise<void>;
  findExpiredVersionIdsByRetentionPolicy(limit: number): Promise<string[]>;
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
      networkFileId: version.networkFileId,
      size: version.size,
      status: version.status || FileVersionStatus.EXISTS,
    });

    return FileVersion.build(createdVersion.toJSON());
  }

  async upsert(version: CreateFileVersionData): Promise<FileVersion> {
    const [instance] = await this.model.upsert(
      {
        fileId: version.fileId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status || FileVersionStatus.EXISTS,
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

  async deleteAllByFileId(fileId: string): Promise<void> {
    await this.model.update(
      { status: FileVersionStatus.DELETED },
      {
        where: { fileId },
      },
    );
  }

  async findExpiredVersionIdsByRetentionPolicy(
    limit: number,
  ): Promise<string[]> {
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
