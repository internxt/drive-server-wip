import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File as FileModel } from './file.model';
import { File } from './file.domain';

export interface FileRepository {
  findAll(): Promise<Array<File> | []>;
  findAllByFolderIdAndUserId(
    folderId: number,
    userId: string,
    deleted: boolean,
  ): Promise<Array<File> | []>;
  findOne(fileId: string, userId: string): Promise<File | null>;
  updateByFieldIdAndUserId(
    fileId: string,
    userId: string,
    update: Partial<File>,
  ): Promise<File>;
}

@Injectable()
export class SequelizeFileRepository implements FileRepository {
  constructor(
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
  ) {}

  async findAll(): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll();
    return files.map((file) => {
      return this.toDomain(file);
    });
  }
  async findAllByFolderIdAndUserId(
    folderId: number,
    userId: string,
    deleted: boolean,
  ): Promise<Array<File> | []> {
    const files = await this.fileModel.findAll({
      where: { folderId, userId, deleted: deleted ? 1 : 0 },
    });
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  async findOne(fileId: string, userId: string): Promise<File | null> {
    const file = await this.fileModel.findOne({
      where: {
        fileId,
        userId,
      },
    });
    return file ? this.toDomain(file) : null;
  }

  async updateByFieldIdAndUserId(
    fileId: string,
    userId: string,
    update: Partial<File>,
  ): Promise<File> {
    const file = await this.fileModel.findOne({
      where: {
        fileId,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }
    file.set(update);
    await file.save();
    return this.toDomain(file);
  }

  toDomain(model): File {
    const file = File.build(model.toJSON());
    return file;
  }

  toModel(domain) {
    return domain.toJSON();
  }
}
