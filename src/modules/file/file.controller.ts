import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from './file.usecase';
import { BadRequestParamOutOfRangeException } from '../../lib/http/errors';
import { isNumber } from '../../lib/validators';
import API_LIMITS from '../../lib/http/limits';
import { File } from './file.domain';
import { validate } from 'uuid';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { FolderUseCases } from '../folder/folder.usecase';

const filesStatuses = ['ALL', 'EXISTS', 'TRASHED', 'DELETED'] as const;

@ApiTags('File')
@Controller('files')
export class FileController {
  constructor(
    private readonly fileUseCases: FileUseCases,
    private readonly folderUseCases: FolderUseCases,
  ) {}

  @Get('/count')
  async getFileCount(
    @UserDecorator() user: User,
    @Query('status') status?: 'orphan' | 'trashed',
  ) {
    let count: number;

    if (status) {
      if (status === 'orphan') {
        count = await this.fileUseCases.getOrphanFilesCount(user.id);
      } else if (status === 'trashed') {
        count = await this.fileUseCases.getTrashFilesCount(user.id);
      } else {
        throw new BadRequestException();
      }
    } else {
      count = await this.fileUseCases.getDriveFilesCount(user.id);
    }

    return { count };
  }

  @Get('/:uuid/meta')
  async getFileMetadata(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: File['uuid'],
  ) {
    if (!validate(fileUuid)) {
      throw new BadRequestException('Invalid UUID');
    }

    try {
      const file = await this.fileUseCases.getFileMetadata(user, fileUuid);

      return file;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const { email, uuid } = user;
      const err = error as Error;

      new Logger().error(
        `[FILE/METADATA] ERROR: ${err.message}, CONTEXT ${JSON.stringify({
          user: { email, uuid },
        })} STACK: ${err.stack || 'NO STACK'}`,
      );
    }
  }

  @Put('/:uuid')
  async replaceFile(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: File['uuid'],
    @Body() fileData: ReplaceFileDto,
  ) {
    try {
      const file = await this.fileUseCases.replaceFile(
        user,
        fileUuid,
        fileData,
      );

      return file;
    } catch (error) {
      const err = error as Error;
      const { email, uuid } = user;
      Logger.error(
        `[SHARING/REPLACE] Error while replacing file. CONTEXT:${JSON.stringify(
          {
            user: { email, uuid },
          },
        )}}, STACK: ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('/')
  async getFiles(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: (typeof filesStatuses)[number],
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('updatedAt') updatedAt?: string,
  ) {
    if (!isNumber(limit) || !isNumber(offset)) {
      throw new BadRequestException('Limit or offset are not numbers');
    }

    if (
      limit < API_LIMITS.FILES.GET.LIMIT.LOWER_BOUND ||
      limit > API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'limit',
        API_LIMITS.FILES.GET.LIMIT.LOWER_BOUND,
        API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND,
      );
    }

    if (
      offset < API_LIMITS.FILES.GET.OFFSET.LOWER_BOUND ||
      offset > API_LIMITS.FILES.GET.OFFSET.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'offset',
        API_LIMITS.FILES.GET.OFFSET.LOWER_BOUND,
        API_LIMITS.FILES.GET.OFFSET.UPPER_BOUND,
      );
    }

    const knownStatus = filesStatuses.includes(status);

    if (!knownStatus) {
      throw new BadRequestException(`Unknown status "${status.toString()}"`);
    }

    const fns: Record<string, (...args) => Promise<File[]>> = {
      ALL: this.fileUseCases.getAllFilesUpdatedAfter,
      EXISTS: this.fileUseCases.getNotTrashedFilesUpdatedAfter,
      TRASHED: this.fileUseCases.getTrashedFilesUpdatedAfter,
      DELETED: this.fileUseCases.getRemovedFilesUpdatedAfter,
    };

    const files: File[] = await fns[status].bind(this.fileUseCases)(
      user.id,
      new Date(updatedAt || 1),
      { limit, offset, sort: sort && order && [[sort, order]] },
    );

    return files.map((f) => {
      delete f.deleted;
      delete f.deletedAt;
      delete f.removed;
      delete f.removedAt;

      if (!f.plainName) {
        f.plainName = this.fileUseCases.decrypFileName(f).plainName;
      }

      return f;
    });
  }

  @Patch('/:uuid')
  async moveFile(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: File['uuid'],
    @Body() moveFileData: MoveFileDto,
  ) {
    if (!validate(fileUuid) || !validate(moveFileData.destinationFolder)) {
      throw new BadRequestException('Invalid UUID provided');
    }
    const file = await this.fileUseCases.moveFile(
      user,
      fileUuid,
      moveFileData.destinationFolder,
    );
    return file;
  }

  @Get('/meta')
  async getFileMetaByPath(
    @UserDecorator() user: User,
    @Query('path') encodedPath: string,
  ) {
    const filePath = Buffer.from(encodedPath, 'base64').toString('binary');
    if (!filePath || filePath.length === 0 || !filePath.includes('/')) {
      throw new BadRequestException('Invalid path provided');
    }

    try {
      const possibleFiles = await this.fileUseCases.getFilesByPathAndUser(
        filePath,
        user.id,
      );

      if (possibleFiles.length === 0) {
        throw new NotFoundException('File not found');
      }

      if (possibleFiles.length === 1) {
        return { file: possibleFiles[0] };
      } else {
        // If there are multiple files under the same depth and filename, we can use the ancestors to indentify the correct file
        const firstFolder = this.fileUseCases.getPathFirstFolder(filePath);
        for (const possibleFile of possibleFiles) {
          const ancestors = await this.folderUseCases.getFolderAncestors(
            user,
            possibleFile.folderUuid,
          );
          const firstAncestorPosition = ancestors.length - 2; // the last ancestor folder from the array is the root folder
          if (firstAncestorPosition >= 0) {
            const firstAncestor = ancestors[firstAncestorPosition];

            if (firstAncestor.plainName === firstFolder) {
              return { file: possibleFile };
            }
          }
        }
        throw new NotFoundException('File not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const { email, uuid } = user;
      const err = error as Error;

      new Logger().error(
        `[FILE/METADATABYPATH] ERROR: ${err.message}, CONTEXT ${JSON.stringify({
          user: { email, uuid },
        })} STACK: ${err.stack || 'NO STACK'}`,
      );
    }
  }
}
