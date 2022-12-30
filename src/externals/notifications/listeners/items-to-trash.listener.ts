import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FileUseCases } from '../../../modules/file/file.usecase';
import { File } from '../../../modules/file/file.domain';
import { FolderUseCases } from '../../../modules/folder/folder.usecase';
import { ItemToTrash } from '../../../modules/trash/dto/controllers/move-items-to-trash.dto';
import { ItemsToTrashEvent } from '../events/items-to-trash.event';
import { Folder } from '../../../modules/folder/folder.domain';

@Injectable()
export class ItemToTrashListener {
  constructor(
    private readonly fileUserCases: FileUseCases,
    private readonly folderUserCases: FolderUseCases,
  ) {}

  @OnEvent('notification.itemsToTrash')
  async handleItemsTrashed(event: ItemsToTrashEvent): Promise<void> {
    Logger.log(`event ${event.name} handled`, 'ItemToTrashListener');

    const items: Array<ItemToTrash> = event.payload as Array<ItemToTrash>;

    const filesPromise: Array<Promise<File>> = [];
    const foldersPromise: Array<Promise<Folder>> = [];

    for (const item of items) {
      if (item.type === 'file') {
        const promise = this.fileUserCases.getFileByFildeId(item.id);
        filesPromise.push(promise);
      } else if (item.type === 'folder') {
        const promise = this.folderUserCases.getFolder(parseInt(item.id));
        foldersPromise.push(promise);
      }
    }

    const files = await Promise.all(filesPromise);

    const folders = await Promise.all(foldersPromise);

    const folderToUpDate = [
      ...files.map((file) => file.folderId),
      ...folders.map((folder) => folder.parentId),
    ];

    await Promise.allSettled(
      folderToUpDate.map((id) =>
        this.folderUserCases.updateFolderUpdatedAt(id),
      ),
    );
  }
}
