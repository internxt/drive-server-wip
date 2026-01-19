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
  deleteAllByFileId(fileId: string): Promise<void>;
  deleteUserVersionsBatch(userId: string, limit: number): Promise<number>;
  sumExistingSizesByUser(userId: string): Promise<number>;
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
}
