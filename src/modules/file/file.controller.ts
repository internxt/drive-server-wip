import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from './file.usecase';
import { BadRequestParamOutOfRangeException } from '../../lib/http/errors';
import { isNumber } from '../../lib/validators';
import API_LIMITS from '../../lib/http/limits';
import { File, FileStatus } from './file.domain';
import { validate } from 'uuid';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { WorkspacesInBehalfValidationFile } from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { CreateFileDto } from './dto/create-file.dto';
import { RequiredSharingPermissions } from '../sharing/guards/sharing-permissions.decorator';
import { SharingActionName } from '../sharing/sharing.domain';
import { SharingPermissionsGuard } from '../sharing/guards/sharing-permissions.guard';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Client } from '../auth/decorators/client.decorator';
import { getPathDepth } from '../../lib/path';
import { Requester } from '../auth/decorators/requester.decorator';
import { FileDto } from './dto/responses/file.dto';
import { UploadGuard } from './guards/upload.guard';
import { ThumbnailDto } from '../thumbnail/dto/thumbnail.dto';
import { CreateThumbnailDto } from '../thumbnail/dto/create-thumbnail.dto';
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';

const filesStatuses = ['ALL', 'EXISTS', 'TRASHED', 'DELETED'] as const;

enum FileStatusQuery {
  EXISTS = 'EXISTS',
  TRASHED = 'TRASHED',
  DELETED = 'DELETED',
  ALL = 'ALL',
}

@ApiTags('File')
@Controller('files')
export class FileController {
  constructor(
    private readonly fileUseCases: FileUseCases,
    private readonly storageNotificationService: StorageNotificationService,
    private readonly thumbnailUseCases: ThumbnailUseCases,
  ) {}

  @Post('/')
  @ApiOperation({
    summary: 'Create File',
  })
  @ApiOkResponse({ type: FileDto })
  @ApiBearerAuth()
  @RequiredSharingPermissions(SharingActionName.UploadFile)
  @UseGuards(SharingPermissionsGuard, UploadGuard)
  async createFile(
    @UserDecorator() user: User,
    @Body() createFileDto: CreateFileDto,
    @Client() clientId: string,
  ): Promise<FileDto> {
    const file = await this.fileUseCases.createFile(user, createFileDto);

    this.storageNotificationService.fileCreated({
      payload: file,
      user: user,
      clientId,
    });

    return file;
  }

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
  @ApiOkResponse({ type: FileDto })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'file',
    },
  ])
  @WorkspacesInBehalfValidationFile()
  async getFileMetadata(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: string,
  ): Promise<FileDto> {
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
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'file',
    },
  ])
  @ApiOkResponse({ type: FileDto })
  @WorkspacesInBehalfValidationFile()
  async replaceFile(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: string,
    @Body() fileData: ReplaceFileDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FileDto> {
    try {
      const file = await this.fileUseCases.replaceFile(
        user,
        fileUuid,
        fileData,
      );

      this.storageNotificationService.fileUpdated({
        payload: file,
        user: requester,
        clientId,
      });

      return file;
    } catch (error) {
      const err = error as Error;
      const { email, uuid } = user;
      Logger.error(
        `[FILE/REPLACE] Error while replacing file. CONTEXT:${JSON.stringify({
          user: { email, uuid },
        })}}, STACK: ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Put('/:uuid/meta')
  @ApiOperation({
    summary: 'Update File data',
  })
  @ApiOkResponse({ type: FileDto })
  @ApiBearerAuth()
  @ApiParam({
    name: 'uuid',
    type: String,
    required: true,
    description: 'file uuid',
  })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'file',
    },
  ])
  @RequiredSharingPermissions(SharingActionName.RenameItems)
  @WorkspacesInBehalfValidationFile()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
    }),
  )
  async updateFileMetadata(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe)
    fileUuid: File['uuid'],
    @Body() updateFileMetaDto: UpdateFileMetaDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FileDto> {
    if (!updateFileMetaDto || Object.keys(updateFileMetaDto).length === 0) {
      throw new BadRequestException('Missing update file metadata');
    }
    const result = await this.fileUseCases.updateFileMetaData(
      user,
      fileUuid,
      updateFileMetaDto,
    );

    this.storageNotificationService.fileUpdated({
      payload: result,
      user: requester,
      clientId,
    });

    return result;
  }

  @Get('/')
  @ApiOkResponse({ isArray: true, type: FileDto })
  @ApiQuery({ name: 'bucket', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  @ApiQuery({ name: 'updatedAt', required: false })
  @ApiQuery({ name: 'status', enum: FileStatusQuery })
  async getFiles(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: FileStatusQuery,
    @Query('bucket') bucket?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('updatedAt') updatedAt?: string,
  ): Promise<FileDto[]> {
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
      bucket,
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
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'file',
    },
  ])
  @ApiOkResponse({ type: FileDto })
  @WorkspacesInBehalfValidationFile()
  async moveFile(
    @UserDecorator() user: User,
    @Param('uuid') fileUuid: string,
    @Body() moveFileData: MoveFileDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FileDto> {
    if (!validate(fileUuid) || !validate(moveFileData.destinationFolder)) {
      throw new BadRequestException('Invalid UUID provided');
    }
    const file = await this.fileUseCases.moveFile(
      user,
      fileUuid,
      moveFileData.destinationFolder,
    );

    this.storageNotificationService.fileUpdated({
      payload: file,
      user: requester,
      clientId,
    });

    return file;
  }

  @Get('/recents')
  async getRecentFiles(
    @UserDecorator() user: User,
    @Query('limit') limit?: number,
  ) {
    if (!limit || !isNumber(limit)) {
      limit = API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND;
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

    const files = this.fileUseCases.getFiles(
      user.id,
      {
        status: FileStatus.EXISTS,
      },
      {
        limit,
        offset: 0,
        sort: [['updatedAt', 'DESC']],
      },
    );

    return files;
  }

  @Get('/meta')
  @ApiOkResponse({ type: FileDto })
  async getFileMetaByPath(
    @UserDecorator() user: User,
    @Query('path') filePath: string,
  ): Promise<FileDto> {
    if (!filePath || filePath.length === 0 || !filePath.includes('/')) {
      throw new BadRequestException('Invalid path provided');
    }

    if (getPathDepth(filePath) > 20) {
      throw new BadRequestException('Path is too deep');
    }

    try {
      const file = await this.fileUseCases.getFileMetadataByPath(
        user,
        filePath,
      );
      if (!file) {
        throw new NotFoundException('File not found');
      }
      return file;
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

  @Post('/thumbnail')
  @ApiOperation({
    summary: 'Create Thumbnail',
  })
  @ApiOkResponse({ type: ThumbnailDto })
  @ApiBearerAuth()
  @RequiredSharingPermissions(SharingActionName.UploadFile)
  @GetDataFromRequest([
    {
      sourceKey: 'body',
      fieldName: 'fileUuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'file',
    },
  ])
  @WorkspacesInBehalfValidationFile()
  @UseGuards(SharingPermissionsGuard)
  async createThumbnail(
    @UserDecorator() user: User,
    @Body() body: CreateThumbnailDto,
  ): Promise<ThumbnailDto> {
    return this.thumbnailUseCases.createThumbnail(user, body);
  }

  @Delete('/:uuid')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete file from storage and database',
  })
  async deleteFileByUuid(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Client() clientId: string,
  ) {
    const { id } = await this.fileUseCases.deleteFilePermanently(user, {
      uuid,
    });

    this.storageNotificationService.fileDeleted({
      payload: { id, uuid },
      user,
      clientId,
    });

    return { deleted: true };
  }

  @Delete('/:bucketId/:fileId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete file from storage by fileId',
  })
  async deleteFileByFileId(
    @UserDecorator() user: User,
    @Param('bucketId') bucketId: string,
    @Param('fileId') fileId: string,
    @Client() clientId: string,
  ) {
    const { fileExistedInDb, id, uuid } =
      await this.fileUseCases.deleteFileByFileId(user, bucketId, fileId);

    if (fileExistedInDb) {
      this.storageNotificationService.fileDeleted({
        payload: { id, uuid },
        user,
        clientId,
      });
    }
  }
}
