import { Inject, Injectable } from '@nestjs/common';
import { FileService } from '../file/file.service';
import { FolderService } from '../folder/folder.service';
import { MoveItemsToTrashDto } from './dto/move-items-to-trash.dto';

@Injectable()
export class TrashService {
  @Inject(FileService)
  private readonly fileService: FileService;

  @Inject(FolderService)
  private readonly folderService: FolderService;

  async getTrash(user) {
    const folderId = user.rootFolderId;
    const [currentFolder, childrenFolders, files] = await Promise.all([
      this.folderService.getFolder(folderId),
      this.folderService.getChildrenFoldersToUser(folderId, user.id, true),
      this.fileService.getByFolderAndUser(folderId, user.id, true),
    ]);
    return {
      ...currentFolder,
      children: childrenFolders,
      files,
    };
  }

  async addItems(userId, { items }: MoveItemsToTrashDto): Promise<void> {
    for (const item of items) {
      if (item.type === 'file') {
        await this.fileService.moveFileToTrash(item.id, userId);
      } else if (item.type === 'folder') {
        await this.folderService.moveFolderToTrash(parseInt(item.id));
      }
    }
    return;
  }
}