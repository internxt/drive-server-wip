import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  NotImplementedException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FolderUseCases } from './folder.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from '../file/file.usecase';
import { Folder, SortableFolderAttributes } from './folder.domain';
import { File, FileStatus, SortableFileAttributes } from '../file/file.domain';
import logger from '../../externals/logger';
import { validate } from 'uuid';

const foldersStatuses = ['ALL', 'EXISTS', 'TRASHED', 'DELETED'] as const;

export class BadRequestWrongFolderIdException extends BadRequestException {
  constructor() {
    super('Folder id should be a number and higher than 0');

    Object.setPrototypeOf(this, BadRequestWrongFolderIdException.prototype);
  }
}

export class BadRequestWrongOffsetOrLimitException extends BadRequestException {
  constructor() {
    super('Offset and limit should be numbers higher than 0');

    Object.setPrototypeOf(
      this,
      BadRequestWrongOffsetOrLimitException.prototype,
    );
  }
}

export class BadRequestOutOfRangeLimitException extends BadRequestException {
  constructor() {
    super('Limit should be between 1 and 50');

    Object.setPrototypeOf(this, BadRequestOutOfRangeLimitException.prototype);
  }
}

export class BadRequestInvalidOffsetException extends BadRequestException {
  constructor() {
    super('Offset should be higher than 0');

    Object.setPrototypeOf(this, BadRequestInvalidOffsetException.prototype);
  }
}

@ApiTags('Folder')
@Controller('folders')
export class FolderController {
  constructor(
    private readonly folderUseCases: FolderUseCases,
    private readonly fileUseCases: FileUseCases,
  ) {}

  @Get('/count')
  async getFolderCount(
    @UserDecorator() user: User,
    @Query('status') status?: 'orphan' | 'trashed',
  ) {
    let count: number;

    if (status) {
      if (status === 'orphan') {
        count = await this.folderUseCases.getOrphanFoldersCount(user.id);
      } else if (status === 'trashed') {
        count = await this.folderUseCases.getTrashFoldersCount(user.id);
      } else {
        throw new BadRequestException();
      }
    } else {
      count = await this.folderUseCases.getDriveFoldersCount(user.id);
    }

    return { count };
  }

  @Delete('/')
  async deleteFolders(
    @UserDecorator() user: User,
    @Query('status') status: 'orphan' | 'trashed',
  ) {
    if (!status) {
      throw new BadRequestException();
    }
    if (status === 'trashed') {
      throw new NotImplementedException();
    }

    if (status === 'orphan') {
      const deletedCount = await this.folderUseCases.deleteOrphansFolders(
        user.id,
      );

      return { deletedCount };
    } else {
      throw new BadRequestException();
    }
  }

  @Get(':id/files')
  async getFolderFiles(
    @UserDecorator() user: User,
    @Param('id') folderId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('sort') sort?: SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    const isNumber = (n) => !Number.isNaN(parseInt(n.toString()));

    if (folderId < 1 || !isNumber(folderId)) {
      throw new BadRequestWrongFolderIdException();
    }

    if (!isNumber(limit) || !isNumber(offset)) {
      throw new BadRequestWrongOffsetOrLimitException();
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestOutOfRangeLimitException();
    }

    if (offset < 0) {
      throw new BadRequestInvalidOffsetException();
    }

    const files = await this.fileUseCases.getFiles(
      user.id,
      {
        folderId,
        status: FileStatus.EXISTS,
      },
      {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
      },
    );

    return { result: files };
  }

  @Get(':id/folders')
  async getFolderFolders(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('id') folderId: number,
    @Query('sort') sort?: SortableFolderAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    const isNumber = (n) => !Number.isNaN(parseInt(n.toString()));

    if (folderId < 1 || !isNumber(folderId)) {
      throw new BadRequestWrongFolderIdException();
    }

    if (!isNumber(limit) || !isNumber(offset)) {
      throw new BadRequestWrongOffsetOrLimitException();
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestOutOfRangeLimitException();
    }

    if (offset < 0) {
      throw new BadRequestInvalidOffsetException();
    }

    const folders = await this.folderUseCases.getFolders(
      user.id,
      {
        parentId: folderId,
        deleted: false,
      },
      {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
      },
    );

    return { result: folders };
  }

  @Get('/')
  async getFolders(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: typeof foldersStatuses[number],
    @Query('updatedAt') updatedAt?: string,
  ) {
    if (!status) {
      throw new BadRequestException('Missing "status" query param');
    }
    if (!limit || (!offset && offset !== 0)) {
      throw new BadRequestException('Missing "offset" or "limit" param');
    }

    const knownStatus = foldersStatuses.includes(status);

    if (!knownStatus) {
      throw new BadRequestException(`Unknown status "${status.toString()}"`);
    }

    const isNumber = (n) => !Number.isNaN(parseInt(n.toString()));

    if (!isNumber(limit) || !isNumber(offset)) {
      throw new BadRequestWrongOffsetOrLimitException();
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestOutOfRangeLimitException();
    }

    if (offset < 0) {
      throw new BadRequestInvalidOffsetException();
    }

    try {
      const fns: Record<string, (...args) => Promise<Folder[]>> = {
        ALL: this.folderUseCases.getAllFoldersUpdatedAfter,
        EXISTS: this.folderUseCases.getNotTrashedFoldersUpdatedAfter,
        TRASHED: this.folderUseCases.getTrashedFoldersUpdatedAfter,
        DELETED: this.folderUseCases.getRemovedFoldersUpdatedAfter,
      };

      const folders: Folder[] = await fns[status].bind(this.folderUseCases)(
        user.id,
        new Date(updatedAt || 1),
        { limit, offset },
      );

      return folders.map((f) => {
        if (!f.plainName) {
          f.plainName = this.folderUseCases.decryptFolderName(f).plainName;
        }

        let status: 'EXISTS' | 'TRASHED' | 'DELETED';

        if (f.removed) {
          status = 'DELETED';
        } else if (f.deleted) {
          status = 'TRASHED';
        } else {
          status = 'EXISTS';
        }

        delete f.deleted;
        delete f.deletedAt;
        delete f.removed;
        delete f.removedAt;

        return {
          ...f,
          status,
        };
      });
    } catch (error) {
      const err = error as Error;

      Logger.error(
        `[FOLDERS/GET]: ERROR for user ${user.uuid} ${err.message}. ${
          err.stack || 'NO STACK'
        }`,
      );

      throw err;
    }
  }

  @Get('/:uuid/meta')
  async getFolder(
    @UserDecorator() user: User,
    @Param('uuid') folderUuid: Folder['uuid'],
  ) {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
    }

    try {
      const folder = await this.folderUseCases.getFolderByUuidAndUser(
        folderUuid,
        user,
      );

      return folder;
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      logger('error', {
        id: 'get-folder',
        user: user.uuid,
        message: `Error getting folder ${err.message}. STACK ${
          err.stack || 'NO STACK'
        }`,
      });
    }
  }
}
