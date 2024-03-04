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
  NotFoundException,
  Res,
  Logger,
  HttpStatus,
  UseFilters,
  InternalServerErrorException,
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
import { File, FileStatus } from '../file/file.domain';
import logger from '../../externals/logger';
import { v4 } from 'uuid';
import { Response } from 'express';
import { HttpExceptionFilter } from '../../lib/http/http-exception.filter';
import { FeatureLimitUsecases } from '../feature-limit/feature-limit.usecase';
import { Cron } from '@nestjs/schedule';

@ApiTags('Trash')
@Controller('storage/trash')
export class TrashController {
  constructor(
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
    private notificationService: NotificationService,
    private trashUseCases: TrashUseCases,
    private featureLimitsUseCases: FeatureLimitUsecases,
  ) {}

  @Get('/paginated')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gets trash content',
  })
  @ApiOkResponse({ description: 'Files on trash for a given folder' })
  async getTrashedFilesPaginated(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('type') type: 'files' | 'folders',
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!limit || offset === undefined || !type) {
      throw new BadRequestException();
    }

    if (type !== 'files' && type !== 'folders') {
      throw new BadRequestException();
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit should be between 1 and 50');
    }

    let userTierId = user.tierId;
    if (!userTierId) {
      const freeTier = await this.featureLimitsUseCases.getFreeTier();
      userTierId = freeTier.id;
    }

    const storageDaysLimit =
      await this.featureLimitsUseCases.getTierMaxTrashStorageDays(userTierId);
    const storageDays = storageDaysLimit?.getLimitValue();
    const maxStorageDate = new Date();
    if (typeof storageDays === 'number') {
      maxStorageDate.setDate(maxStorageDate.getDate() - storageDays);
    }

    try {
      let result: File[] | Folder[];

      if (type === 'files') {
        result = await this.fileUseCases.getFiles(
          user.id,
          {
            status: FileStatus.TRASHED,
          },
          { limit, offset, updatedAfter: maxStorageDate },
        );
      } else {
        result = await this.folderUseCases.getFolders(
          user.id,
          {
            deleted: true,
            removed: false,
          },
          { limit, offset, updatedAfter: maxStorageDate },
        );
      }

      return { result };
    } catch (error) {
      const { email, uuid } = user;
      new Logger().error(
        `[TRASH/GET_PAGINATED] ERROR: ${
          (error as Error).message
        } USER: ${JSON.stringify({
          email,
          uuid,
        })} STACK: ${(error as Error).stack}`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);

      return { error: 'Internal Server Error' };
    }
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
        this.fileUseCases.moveFilesToTrash(user, fileIds),
        this.folderUseCases.moveFoldersToTrash(user, folderIds),
      ]);

      this.userUseCases
        .getWorkspaceMembersByBrigeUser(user.bridgeUser)
        .then((members) => {
          members.forEach(
            ({ email, uuid }: { email: string; uuid: string }) => {
              const itemsToTrashEvent = new ItemsToTrashEvent(
                moveItemsDto.items,
                email,
                clientId,
                uuid,
              );
              this.notificationService.add(itemsToTrashEvent);
            },
          );
        })
        .catch((err) => {
          // no op
        });
    } catch (err) {
      const { email, uuid } = user;

      new Logger().error(
        `[TRASH/ADD] ERROR: ${(err as Error).message}, BODY ${JSON.stringify({
          ...moveItemsDto,
          user: { email, uuid },
        })}, STACK: ${(err as Error).stack}`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);

      return { error: 'Internal Server Error' };
    }
  }

  @UseFilters(new HttpExceptionFilter())
  @Delete('/all')
  @HttpCode(200)
  @ApiOperation({
    summary: "Deletes all items from user's trash",
  })
  async clearTrash(@UserDecorator() user: User) {
    try {
      await this.trashUseCases.emptyTrash(user);
    } catch (error) {
      new Logger().error(
        `[TRASH/EMPTY_TRASH] ERROR: ${
          (error as Error).message
        } USER: ${JSON.stringify(user)} STACK: ${(error as Error).stack}`,
      );

      throw new InternalServerErrorException();
    }
  }

  @UseFilters(new HttpExceptionFilter())
  @Delete('/all/request')
  requestEmptyTrash(user: User) {
    try {
      this.trashUseCases.emptyTrash(user);
    } catch (error) {
      new Logger().error(
        `[TRASH/REQUEST_EMPTY_TRASH] ERROR: ${
          (error as Error).message
        } USER: ${JSON.stringify(user)} STACK: ${(error as Error).stack}`,
      );

      throw new InternalServerErrorException();
    }
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

  @Cron('*/5 * * * *', { name: 'deleteExpiredItems' })
  async removeExpiredItems() {
    await this.trashUseCases.removeExpiredItems();
  }
}
