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
import {
  ItemType,
  MoveItemsToTrashDto,
} from './dto/controllers/move-items-to-trash.dto';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Client } from '../auth/decorators/client.decorator';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { User } from '../user/user.domain';
import { TrashUseCases } from './trash.usecase';
import {
  DeleteItemsDto,
  DeleteItemType,
} from './dto/controllers/delete-item.dto';
import { Folder, SortableFolderAttributes } from '../folder/folder.domain';
import { File, FileStatus, SortableFileAttributes } from '../file/file.domain';
import logger from '../../externals/logger';
import { v4 } from 'uuid';
import { HttpExceptionFilter } from '../../lib/http/http-exception.filter';
import {
  WorkspaceResourcesAction,
  WorkspacesInBehalfGuard,
} from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { BasicPaginationDto } from '../../common/dto/basic-pagination.dto';

@ApiTags('Trash')
@Controller('storage/trash')
export class TrashController {
  constructor(
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
    private readonly storageNotificationService: StorageNotificationService,
    private trashUseCases: TrashUseCases,
  ) {}

  @Get('/paginated')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gets trash content',
  })
  @ApiOkResponse({ description: 'Files on trash for a given folder' })
  async getTrashedFilesPaginated(
    @UserDecorator() user: User,
    @Query() pagination: BasicPaginationDto,
    @Query('type') type: 'files' | 'folders',
    @Query('sort') sort?: SortableFolderAttributes | SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    if (!pagination.limit || pagination.offset === undefined || !type) {
      throw new BadRequestException();
    }

    if (type !== 'files' && type !== 'folders') {
      throw new BadRequestException();
    }

    if (pagination.limit < 1 || pagination.limit > 50) {
      throw new BadRequestException('Limit should be between 1 and 50');
    }

    try {
      let result: File[] | Folder[];

      if (type === 'files') {
        const files = await this.fileUseCases.getFiles(
          user.id,
          { status: FileStatus.TRASHED },
          {
            limit: pagination.limit,
            offset: pagination.offset,
            sort: sort && order && [[sort, order]],
          },
        );

        result = await this.fileUseCases.filterFilesWithNonDeletedFolders(
          user,
          files,
        );
      } else {
        const folders = await this.folderUseCases.getFolders(
          user.id,
          { deleted: true, removed: false },
          {
            limit: pagination.limit,
            offset: pagination.offset,
            sort: sort && order && [[sort as SortableFolderAttributes, order]],
          },
        );

        result = await this.folderUseCases.filterFoldersByUndeletedParent(
          user,
          folders,
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

      throw new InternalServerErrorException();
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
  @GetDataFromRequest([{ sourceKey: 'body', fieldName: 'items' }])
  @WorkspacesInBehalfGuard(WorkspaceResourcesAction.AddItemsToTrash)
  async moveItemsToTrash(
    @Body() moveItemsDto: MoveItemsToTrashDto,
    @UserDecorator() user: User,
    @Client() clientId: string,
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
      const fileUuids: string[] = [];
      const folderIds: number[] = [];
      const folderUuids: string[] = [];

      for (const item of moveItemsDto.items) {
        switch (item.type) {
          case ItemType.FILE:
            if (item.id) {
              fileIds.push(item.id);
            } else {
              fileUuids.push(item.uuid);
            }
            break;
          case ItemType.FOLDER:
            if (item.id) {
              folderIds.push(parseInt(item.id, 10));
            } else {
              folderUuids.push(item.uuid);
            }
            break;
          default:
            throw new BadRequestException(`type ${item.type} invalid`);
        }
      }
      await Promise.all([
        fileIds.length > 0 || fileUuids.length > 0
          ? this.fileUseCases.moveFilesToTrash(user, fileIds, fileUuids)
          : Promise.resolve(),
        this.folderUseCases.moveFoldersToTrash(user, folderIds, folderUuids),
      ]);

      this.userUseCases
        .getWorkspaceMembersByBrigeUser(user.bridgeUser)
        .then((members) => {
          members.forEach((member) => {
            this.storageNotificationService.itemsTrashed({
              payload: moveItemsDto.items,
              user: member,
              clientId,
            });
          });
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
      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new InternalServerErrorException({
        error: 'Internal Server Error',
      });
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
  @GetDataFromRequest([{ sourceKey: 'body', fieldName: 'items' }])
  @WorkspacesInBehalfGuard(WorkspaceResourcesAction.DeleteItemsFromTrash)
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
    const { items } = deleteItemsDto;

    const filesIds: File['id'][] = [];
    const filesUuids: File['uuid'][] = [];
    const foldersIds: Folder['id'][] = [];
    const foldersUuids: Folder['uuid'][] = [];

    for (const item of items) {
      if (item.type === DeleteItemType.FILE) {
        if (item.id) filesIds.push(parseInt(item.id, 10));
        if (item.uuid) filesUuids.push(item.uuid);
      } else if (item.type === DeleteItemType.FOLDER) {
        if (item.id) foldersIds.push(parseInt(item.id, 10));
        if (item.uuid) foldersUuids.push(item.uuid);
      }
    }

    const [files, filesByUuid, folders, foldersByUuid] = await Promise.all([
      filesIds.length > 0
        ? this.fileUseCases.getFilesByIds(user, filesIds)
        : [],
      filesUuids.length > 0 ? this.fileUseCases.getByUuids(filesUuids) : [],
      foldersIds.length > 0
        ? this.folderUseCases.getFoldersByIds(user, foldersIds)
        : [],
      foldersUuids.length > 0
        ? this.folderUseCases.getByUuids(foldersUuids)
        : [],
    ]);

    const allFiles = [...files, ...filesByUuid];
    const allFolders = [...folders, ...foldersByUuid];

    await this.trashUseCases.deleteItems(user, allFiles, allFolders);
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
