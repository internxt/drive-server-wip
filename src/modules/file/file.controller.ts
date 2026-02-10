import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { UserTier } from '../auth/decorators/user-tier.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from './file.usecase';
import { BadRequestParamOutOfRangeException } from '../../lib/http/errors';
import { isNumber } from '../../lib/validators';
import API_LIMITS from '../../lib/http/limits';
import { File, FileStatus } from './file.domain';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { UpdateFileMetaDto } from './dto/update-file-meta.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { WorkspacesInBehalfValidationFile } from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { CreateFileDto } from './dto/create-file.dto';
import { GetFilesDto } from './dto/get-files.dto';
import { RequiredSharingPermissions } from '../sharing/guards/sharing-permissions.decorator';
import { SharingActionName } from '../sharing/sharing.domain';
import { SharingPermissionsGuard } from '../sharing/guards/sharing-permissions.guard';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Client } from '../../common/decorators/client.decorator';
import { getPathDepth } from '../../lib/path';
import { Requester } from '../auth/decorators/requester.decorator';
import { FileDto } from './dto/responses/file.dto';
import { GetFileLimitsDto } from './dto/get-file-limits.dto';
import { FileVersionDto } from './dto/responses/file-version.dto';
import { UploadGuard } from './guards/upload.guard';
import { ThumbnailDto } from '../thumbnail/dto/thumbnail.dto';
import { CreateThumbnailDto } from '../thumbnail/dto/create-thumbnail.dto';
import { ThumbnailUseCases } from '../thumbnail/thumbnail.usecase';
import { RequestLoggerInterceptor } from '../../middlewares/requests-logger.interceptor';
import { Version } from '../../common/decorators/version.decorator';
import { Throttle, seconds } from '@nestjs/throttler';

@ApiTags('File')
@Controller('files')
export class FileController {
  private readonly logger = new Logger(FileController.name);
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
  @UseInterceptors(RequestLoggerInterceptor)
  async createFile(
    @UserDecorator() user: User,
    @Body() createFileDto: CreateFileDto,
    @Client() clientId: string,
    @UserTier() tier,
  ): Promise<FileDto> {
    const file = await this.fileUseCases.createFile(user, createFileDto, tier);

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

  @Get('/limits')
  @ApiOperation({
    summary: 'Get file limits based on user tier',
  })
  @ApiOkResponse({ type: GetFileLimitsDto })
  @ApiBearerAuth()
  async getLimits(@UserDecorator() user: User): Promise<GetFileLimitsDto> {
    const versioning = await this.fileUseCases.getVersioningLimits(user.uuid);
    return { versioning };
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
    @Param('uuid', ValidateUUIDPipe) fileUuid: string,
  ): Promise<FileDto> {
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

  @Get('/:uuid/versions')
  @ApiOperation({
    summary: 'Get file versions',
  })
  @ApiOkResponse({ isArray: true, type: FileVersionDto })
  @ApiBearerAuth()
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
  async getFileVersions(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) fileUuid: string,
  ): Promise<FileVersionDto[]> {
    return this.fileUseCases.getFileVersions(user, fileUuid);
  }

  @Delete('/:uuid/versions/:versionId')
  @ApiOperation({
    summary: 'Delete a file version',
  })
  @HttpCode(204)
  @ApiBearerAuth()
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
  async deleteFileVersion(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) fileUuid: string,
    @Param('versionId', ValidateUUIDPipe) versionId: string,
  ): Promise<void> {
    await this.fileUseCases.deleteFileVersion(user, fileUuid, versionId);
  }

  @Post('/:uuid/versions/:versionId/restore')
  @ApiOperation({
    summary: 'Restore a file version',
  })
  @ApiOkResponse({ type: FileDto })
  @ApiBearerAuth()
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
  async restoreFileVersion(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) fileUuid: string,
    @Param('versionId', ValidateUUIDPipe) versionId: string,
  ): Promise<FileDto> {
    return this.fileUseCases.restoreFileVersion(user, fileUuid, versionId);
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

  @Throttle({ short: { ttl: seconds(60), limit: 100 } })
  @Get('/')
  @ApiOkResponse({ isArray: true, type: FileDto })
  async getFiles(
    @UserDecorator() user: User,
    @Query() queryParams: GetFilesDto,
  ): Promise<FileDto[]> {
    const { limit, offset, status, bucket, sort, order, updatedAt, lastId } =
      queryParams;

    const fns: Record<string, (...args) => Promise<File[]>> = {
      ALL: this.fileUseCases.getAllFilesUpdatedAfter,
      EXISTS: this.fileUseCases.getNotTrashedFilesUpdatedAfter,
      TRASHED: this.fileUseCases.getTrashedFilesUpdatedAfter,
      DELETED: this.fileUseCases.getRemovedFilesUpdatedAfter,
    };

    const files: File[] = await fns[status].bind(this.fileUseCases)(
      user.id,
      new Date(updatedAt || 1),
      { limit, offset, sort: sort && order && [[sort, order]], lastId },
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
    @Param('uuid', ValidateUUIDPipe) fileUuid: string,
    @Body() moveFileData: MoveFileDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FileDto> {
    const file = await this.fileUseCases.moveFile(user, fileUuid, moveFileData);

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

  @Throttle({ short: { ttl: seconds(60), limit: 100 } })
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
    @Client() clientId: string,
    @Version() version: string,
  ): Promise<ThumbnailDto> {
    const stillUsesFileId = body.fileId && isNumber(body.fileId);
    if (stillUsesFileId && !body.fileUuid) {
      this.logger.warn(
        `FILE_ID_USAGE: client ${clientId}, version ${version} is using fileId instead of fileUuid.`,
      );
    }

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
