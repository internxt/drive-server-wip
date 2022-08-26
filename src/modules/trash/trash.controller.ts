import {
  Body,
  Controller,
  Post,
  HttpCode,
  Get,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { MoveItemsToTrashDto } from './dto/controllers/move-items-to-trash.dto';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Client } from '../auth/decorators/client.decorator';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { ItemsToTrashEvent } from '../../externals/notifications/events/items-to-trash.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import { User } from '../user/user.domain';
import { TrashUseCases } from './trash.usecase';
@ApiTags('Trash')
@Controller('storage/trash')
export class TrashController {
  constructor(
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
    private notificationService: NotificationService,
    private trashUseCases: TrashUseCases,
  ) {}

  @Get('/')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get trash content',
  })
  @ApiOkResponse({ description: 'Get all folders and files in trash' })
  async getTrash(@UserDecorator() user: User) {
    const folderId = user.rootFolderId;
    const [currentFolder, childrenFolders, files] = await Promise.all([
      this.folderUseCases.getFolder(folderId),
      this.folderUseCases.getChildrenFoldersToUser(folderId, user.id, true),
      this.fileUseCases.getByFolderAndUser(folderId, user.id, true),
    ]);
    return {
      ...currentFolder.toJSON(),
      children: childrenFolders,
      files,
    };
  }

  @Post('add')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add items of files and folders to trash',
  })
  @ApiOkResponse({ description: 'All items moved to trash' })
  @ApiBadRequestResponse({ description: 'Any item id is invalid' })
  async moveItemsToTrash(
    @Body() moveItemsDto: MoveItemsToTrashDto,
    @UserDecorator() user: User,
    @Client() clientId: string,
  ) {
    const fileIds: string[] = [];
    const folderIds: number[] = [];
    for (const item of moveItemsDto.items) {
      if (item.type === 'file') {
        fileIds.push(item.id);
      } else if (item.type === 'folder') {
        folderIds.push(parseInt(item.id));
      } else {
        throw new BadRequestException(`type ${item.type} invalid`);
      }
    }
    await Promise.all([
      this.fileUseCases.moveFilesToTrash(fileIds, user.id),
      this.folderUseCases.moveFoldersToTrash(folderIds),
    ]);

    const workspaceMembers =
      await this.userUseCases.getWorkspaceMembersByBrigeUser(user.bridgeUser);

    workspaceMembers.forEach(({ email }: { email: string }) => {
      const itemsToTrashEvent = new ItemsToTrashEvent(
        moveItemsDto.items,
        email,
        clientId,
      );
      this.notificationService.add(itemsToTrashEvent);
    });
    return;
  }

  @Delete('/all')
  @HttpCode(202)
  @ApiOperation({
    summary: "Deletes all items from user's trash",
  })
  async clearTrash(@UserDecorator() user: User) {
    await this.trashUseCases.clearTrash(user);

    return;
  }
}
