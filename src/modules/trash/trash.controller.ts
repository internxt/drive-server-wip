import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Get,
  HttpCode,
  Post,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
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
import {
  DeleteItemsDto,
  DeleteItemType,
} from './dto/controllers/delete-item.dto';
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
    const [currentFolder, childrenFolders] = await Promise.all([
      this.folderUseCases.getFolder(folderId),
      this.folderUseCases.getChildrenFoldersToUser(folderId, user.id, true),
    ]);
    const childrenFoldersIds = childrenFolders.map(({ id }) => id);
    const files = await this.fileUseCases.getByUserExceptParents(
      user.id,
      childrenFoldersIds,
      true,
    );
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
  clearTrash(@UserDecorator() user: User) {
    this.trashUseCases.clearTrash(user);
  }

  @Delete('/')
  @HttpCode(202)
  @ApiOperation({
    summary: "Deletes all items from user's trash",
  })
  async deleteItems(
    @Body() deleteItemsDto: DeleteItemsDto,
    @UserDecorator() user: User,
  ) {
    const filesId = deleteItemsDto.items
      .filter((item) => item.type === DeleteItemType.FILE)
      .map((item) => item.id);

    const foldersId = deleteItemsDto.items
      .filter((item) => item.type === DeleteItemType.FOLDER)
      .map((item) => parseInt(item.id));

    await this.trashUseCases
      .deleteItems(filesId, foldersId, user)
      .catch((err) => {
        if (err instanceof HttpException) {
          throw err;
        }
      });
  }

  @Delete('/file/:fileId')
  @HttpCode(204)
  @ApiOperation({
    summary: "Deletes a single file form user's trash",
  })
  async deleteFile(
    @Param('fileId') fileId: string,
    @UserDecorator() user: User,
  ) {
    await this.trashUseCases.deleteItems([fileId], [], user);
  }

  @Delete('/folder/:folderId')
  @HttpCode(204)
  @ApiOperation({
    summary: "Deletes a single file form user's trash",
  })
  async deleteFolder(
    @Param('folderId') folderId: number,
    @UserDecorator() user: User,
  ) {
    await this.trashUseCases.deleteItems([], [folderId], user);
  }
}
