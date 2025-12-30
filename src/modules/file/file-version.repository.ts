import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
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
  sumVersionSizeDeltaFromDate(userId: string, sinceDate: Date): Promise<number>;
  sumVersionSizeDeltaBetweenDates(
    userId: string,
    sinceDate: Date,
    untilDate: Date,
  ): Promise<number>;
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

  async sumVersionSizeDeltaFromDate(
    userId: string,
    sinceDate: Date,
  ): Promise<number> {
    const result = await this.model.findAll({
      attributes: [
        [
          Sequelize.literal(`
          SUM(
            CASE
              WHEN status != 'DELETED' THEN size

              -- Versions created BEFORE the period but deleted DURING the period
              WHEN status = 'DELETED' AND created_at < $sinceDate THEN -size

              -- Versions created and deleted DURING the period does not affect delta
              ELSE 0
            END
          )
        `),
          'total',
        ],
      ],
      where: {
        userId,
        [Op.or]: [
          {
            status: { [Op.ne]: FileVersionStatus.DELETED },
            createdAt: {
              [Op.gte]: sinceDate,
            },
          },
          {
            status: FileVersionStatus.DELETED,
            updatedAt: {
              [Op.gte]: sinceDate,
            },
          },
        ],
      },
      bind: {
        sinceDate,
      },
      raw: true,
    });

    return Number(result[0]?.['total']) || 0;
  }

  async sumVersionSizeDeltaBetweenDates(
    userId: string,
    sinceDate: Date,
    untilDate: Date,
  ): Promise<number> {
    const result = await this.model.findAll({
      attributes: [
        [
          Sequelize.literal(`
          SUM(
            CASE
              WHEN status != 'DELETED' THEN size

              -- Versions created BEFORE the period but deleted DURING the period
              WHEN status = 'DELETED' AND created_at < $sinceDate THEN -size

              -- Versions created DURING the period but deleted AFTER the period
              WHEN status = 'DELETED' AND updated_at > $untilDate THEN size

              -- Versions created and deleted DURING the period
              ELSE 0
            END
          )
        `),
          'total',
        ],
      ],
      where: {
        userId,
        [Op.or]: [
          {
            createdAt: {
              [Op.gte]: sinceDate,
              [Op.lte]: untilDate,
            },
          },
          {
            status: FileVersionStatus.DELETED,
            createdAt: {
              [Op.lt]: sinceDate,
            },
            updatedAt: {
              [Op.gte]: sinceDate,
              [Op.lte]: untilDate,
            },
          },
        ],
      },
      bind: {
        sinceDate,
        untilDate,
      },
      raw: true,
    });

    return Number(result[0]?.['total']) || 0;
  }
}
