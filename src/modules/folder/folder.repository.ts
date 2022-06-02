import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Folder } from './folder.model';

export interface FolderRepository {
  findAll(): Promise<Array<Folder> | []>;
  findAllByParentIdAndUserId(
    parentId: number,
    userId: string,
    deleted: boolean,
  ): Promise<Array<Folder> | []>;
  findById(folderId: number): Promise<Folder | null>;
  updateByFolderId(folderId: number, update: Partial<Folder>): Promise<Folder>;
}

@Injectable()
export class SequelizeFolderRepository implements FolderRepository {
  constructor(
    @InjectModel(Folder)
    private folderModel: typeof Folder,
  ) {}

  async findAll(): Promise<Array<Folder> | []> {
    return await this.folderModel.findAll();
  }
  async findAllByParentIdAndUserId(
    parentId: number,
    userId: string,
    deleted: boolean,
  ): Promise<Array<Folder> | []> {
    return await this.folderModel.findAll({
      where: { parentId, userId, deleted: deleted ? 1 : 0 },
    });
  }
  async findById(folderId: number): Promise<Folder> {
    return await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });
  }

  async updateByFolderId(
    folderId: number,
    update: Partial<Folder>,
  ): Promise<Folder> {
    const folder = await this.folderModel.findOne({
      where: {
        id: folderId,
      },
    });

    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    folder.set(update);
    await folder.save();
    return folder;
  }
}
