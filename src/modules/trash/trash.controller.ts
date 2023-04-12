import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Res,
  Logger,
  HttpStatus,
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
import { Folder } from '../folder/folder.domain';
import { File } from '../file/file.domain';
import logger from '../../externals/logger';
import { v4 } from 'uuid';
import { Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';

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
      this.folderUseCases.getFoldersToUser(user.id, { deleted: true }),
    ]);
    const childrenFoldersIds = childrenFolders.map(({ id }) => id);
    const files = await this.fileUseCases.getByUserExceptParents(
      user.id,
      childrenFoldersIds,
      { deleted: true },
    );
    return {
      ...currentFolder.toJSON(),
      children: childrenFolders.map((folder: Folder) =>
        this.folderUseCases.decryptFolderName(folder),
      ),
      files: files.map((file: File) => this.fileUseCases.decrypFileName(file)),
    };
  }

  @Get('/paginated')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gets trash content',
  })
  @ApiOkResponse({ description: 'Files on trash for a given folder' })
  async getTrashedFilesPaginated(
    @UserDecorator() user: User,
    @Query('folderId') folderId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('type') type: 'files' | 'folders',
    @Query('root') root: boolean,
  ) {
    if (
      !limit ||
      offset === undefined ||
      !type ||
      root === undefined ||
      (!root && !folderId)
    ) {
      throw new BadRequestException();
    }

    if (type !== 'files' && type !== 'folders') {
      throw new BadRequestException();
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit should be between 1 and 50');
    }

    let result: File[] | Folder[];

    const deleted = root;

    if (root) {
      if (type === 'files') {
        // Root level could have different folders
        result = await this.fileUseCases.getFiles(
          user.id,
          { deleted: true },
          { limit, offset },
        );
      } else {
        result = await this.folderUseCases.getFolders(
          user.id,
          { deleted: true },
          { limit, offset },
        );
      }
    } else {
      if (type === 'files') {
        result = await this.fileUseCases.getFilesByFolderId(folderId, user.id, {
          deleted,
          limit,
          offset,
        });
      } else {
        result = await this.folderUseCases.getFoldersByParentId(
          folderId,
          user.id,
          {
            deleted,
            limit,
            offset,
          },
        );
      }
    }

    return { result };
  }

  // @UseGuards(ThrottlerGuard)
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
    @Res({ passthrough: true }) res: Response,
  ) {
    if (moveItemsDto.items.length === 0) {
      logger('error', {
        user: user.uuid,
        id: v4(),
        message: 'Trying to add 0 items to the trash',
      });
      return;
    }

    try {
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

      this.userUseCases
        .getWorkspaceMembersByBrigeUser(user.bridgeUser)
        .then((members) => {
          members.forEach(({ email }: { email: string }) => {
            const itemsToTrashEvent = new ItemsToTrashEvent(
              moveItemsDto.items,
              email,
              clientId,
            );
            this.notificationService.add(itemsToTrashEvent);
          });
        })
        .catch((err) => {
          // no op
        });
    } catch (err) {
      let errorMessage = err.message;

      new Logger().error(
        `[TRASH/ADD] ERROR: ${(err as Error).message}, BODY ${JSON.stringify(
          moveItemsDto,
        )}, STACK: ${(err as Error).stack}`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      errorMessage = 'Internal Server Error';

      return { error: errorMessage };
    }
  }

  @Delete('/all')
  @HttpCode(202)
  @ApiOperation({
    summary: "Deletes all items from user's trash",
  })
  async clearTrash(@UserDecorator() user: User) {
    await this.trashUseCases.emptyTrash(user);
  }

  @Delete('/all/request')
  requestEmptyTrash(user: User) {
    this.trashUseCases.emptyTrash(user);
  }

  @Get('/all/check')
  @HttpCode(200)
  async checkIfTrashIsBeingEmptied(user: User) {
    const isBeingEmptied = await this.trashUseCases.checkIfTrashIsBeingEmptied(
      user,
    );

    return { result: isBeingEmptied };
  }

  @Delete('/')
  @HttpCode(202)
  @ApiOperation({
    summary: "Deletes items from user's trash",
  })
  async deleteItems(
    @Body() deleteItemsDto: DeleteItemsDto,
    @UserDecorator() user: User,
  ) {
    // TODO: Uncomment this once all the platforms block deleting more than 50 items
    // if (deleteItemsDto.items.length > 50) {
    //   throw new BadRequestException(
    //     'Items to remove from the trash are limited to 50',
    //   );
    // }

    const filesIds = deleteItemsDto.items
      .filter((item) => item.type === DeleteItemType.FILE)
      .map((item) => parseInt(item.id));

    const foldersIds = deleteItemsDto.items
      .filter((item) => item.type === DeleteItemType.FOLDER)
      .map((item) => parseInt(item.id));

    const files =
      filesIds.length > 0
        ? await this.fileUseCases.getFilesByIds(user, filesIds)
        : [];
    const folders =
      foldersIds.length > 0
        ? await this.folderUseCases.getFoldersByIds(user, foldersIds)
        : [];

    await this.trashUseCases.deleteItems(user, files, folders);
  }

  @Delete('/file/:fileId')
  @HttpCode(204)
  @ApiOperation({
    summary: "Deletes a single file from user's trash",
  })
  async deleteFile(
    @Param('fileId') fileId: string,
    @UserDecorator() user: User,
  ) {
    const files = await this.fileUseCases.getFiles(user.id, { fileId });

    if (files.length === 0) {
      throw new NotFoundException();
    }

    await this.trashUseCases.deleteItems(user, [files[0]], []);
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
    const folders = await this.folderUseCases.getFolders(user.id, {
      id: folderId,
    });

    if (folders.length === 0) {
      throw new NotFoundException();
    }

    await this.trashUseCases.deleteItems(user, [], [folders[0]]);
  }
}
