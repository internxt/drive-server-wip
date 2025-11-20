import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FileVersionModel } from './file-version.model';
import {
  FileVersion,
  FileVersionAttributes,
  FileVersionStatus,
} from './file-version.domain';

export interface FileVersionRepository {
  create(
    version: Omit<FileVersionAttributes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FileVersion>;
  findOrCreate(
    version: Omit<FileVersionAttributes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FileVersion>;
  findAllByFileId(fileId: string): Promise<FileVersion[]>;
  findById(id: string): Promise<FileVersion | null>;
  updateStatus(id: string, status: FileVersionStatus): Promise<void>;
  updateStatusBatch(ids: string[], status: FileVersionStatus): Promise<void>;
  deleteAllByFileId(fileId: string): Promise<void>;
}

@Injectable()
export class SequelizeFileVersionRepository implements FileVersionRepository {
  constructor(
    @InjectModel(FileVersionModel)
    private readonly model: typeof FileVersionModel,
  ) {}

  async create(
    version: Omit<FileVersionAttributes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FileVersion> {
    const createdVersion = await this.model.create({
      fileId: version.fileId,
      networkFileId: version.networkFileId,
      size: version.size,
      status: version.status || FileVersionStatus.EXISTS,
    });

    return FileVersion.build(createdVersion.toJSON());
  }

  async findOrCreate(
    version: Omit<FileVersionAttributes, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FileVersion> {
    const [instance] = await this.model.findOrCreate({
      where: {
        fileId: version.fileId,
        networkFileId: version.networkFileId,
      },
      defaults: {
        size: version.size,
        status: version.status || FileVersionStatus.EXISTS,
      },
    });

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
}
