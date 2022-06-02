import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { File } from './file.model';

export interface FileRepository {
  findAll(): Promise<Array<File> | []>;
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
    @InjectModel(File)
    private fileModel: typeof File,
  ) {}

  async findAll(): Promise<Array<File> | []> {
    return this.fileModel.findAll();
  }

  findOne(fileId: string, userId: string): Promise<any> {
    return this.fileModel.findOne({
      where: {
        fileId,
        userId,
      },
    });
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
    return file;
  }
}
