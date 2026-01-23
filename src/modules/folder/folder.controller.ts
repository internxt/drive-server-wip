import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FolderUseCases } from './folder.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Workspace as WorkspaceDecorator } from '../auth/decorators/workspace.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from '../file/file.usecase';
import { Folder } from './folder.domain';
import { FileStatus } from '../file/file.domain';
import { validate } from 'uuid';
import { isNumber } from '../../lib/validators';
import { MoveFolderDto } from './dto/move-folder.dto';

import { UpdateFolderMetaDto } from './dto/update-folder-meta.dto';
import { WorkspacesInBehalfValidationFolder } from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CheckFoldersExistenceDto } from './dto/folder-existence-in-folder.dto';
import { CheckFileExistenceInFolderDto } from './dto/files-existence-in-folder.dto';
import { RequiredSharingPermissions } from '../sharing/guards/sharing-permissions.decorator';
import { SharingActionName } from '../sharing/sharing.domain';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Client } from '../../common/decorators/client.decorator';
import { BasicPaginationDto } from '../../common/dto/basic-pagination.dto';
import { Workspace } from '../workspaces/domains/workspaces.domain';
import { getPathDepth } from '../../lib/path';
import { CheckFoldersExistenceOldDto } from './dto/folder-existence-in-folder-old.dto';
import { Requester } from '../auth/decorators/requester.decorator';
import {
  ExistentFoldersDto,
  FolderDto,
  FoldersDto,
  ResultFoldersDto,
} from './dto/responses/folder.dto';
import { FolderStatsDto } from './dto/responses/folder-stats.dto';
import {
  ExistentFilesDto,
  FilesDto,
  ResultFilesDto,
} from '../file/dto/responses/file.dto';
import { GetFolderContentDto } from './dto/responses/get-folder-content.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { GetFilesInFoldersDto } from './dto/get-files-in-folder.dto';
import { GetFoldersInFoldersDto } from './dto/get-folders-in-folder.dto';
import { GetFoldersQueryDto } from './dto/get-folders.dto';
import { CustomEndpointThrottleGuard } from '../../guards/custom-endpoint-throttle.guard';
import { CustomThrottle } from '../../guards/custom-endpoint-throttle.decorator';

export class BadRequestWrongFolderIdException extends BadRequestException {
  constructor() {
    super('Folder id should be a number and higher than 0');

    Object.setPrototypeOf(this, BadRequestWrongFolderIdException.prototype);
  }
}

@ApiTags('Folder')
@Controller('folders')
export class FolderController {
  constructor(
    private readonly folderUseCases: FolderUseCases,
    private readonly fileUseCases: FileUseCases,
    private readonly storageNotificationService: StorageNotificationService,
  ) {}

  @UseGuards(CustomEndpointThrottleGuard)
  @CustomThrottle({
    long: { ttl: 3600, limit: 30000 },
  })
  @Post('/')
  @ApiOperation({
    summary: 'Create Folder',
  })
  @ApiBearerAuth()
  @ApiOkResponse({ type: FolderDto })
  async createFolder(
    @UserDecorator() user: User,
    @Body() createFolderDto: CreateFolderDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FolderDto> {
    const folder = await this.folderUseCases.createFolder(
      user,
      createFolderDto,
    );

    const folderDto = { ...folder, status: folder.getFolderStatus() };

    this.storageNotificationService.folderCreated({
      payload: folderDto,
      user: requester,
      clientId,
    });

    return folderDto;
  }

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

  @Get('/content/:uuid/files')
  @ApiOkResponse({ type: FilesDto })
  async getFolderContentFiles(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Query() query: GetFilesInFoldersDto,
  ): Promise<FilesDto> {
    const files = await this.fileUseCases.getFiles(
      user.id,
      {
        folderUuid,
        status: FileStatus.EXISTS,
      },
      {
        limit: query.limit,
        offset: query.offset,
        sort: query.sort && query.order && [[query.sort, query.order]],
      },
    );

    return { files };
  }

  @Get(':id/files')
  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: ResultFilesDto })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  async getFolderFiles(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) folderId: number,
    @Query() query: GetFilesInFoldersDto,
  ): Promise<ResultFilesDto> {
    const files = await this.fileUseCases.getFiles(
      user.id,
      {
        folderId,
        status: FileStatus.EXISTS,
      },
      {
        limit: query.limit,
        offset: query.offset,
        sort: query.sort && query.order && [[query.sort, query.order]],
      },
    );

    return { result: files };
  }

  @Get(':id/file')
  @ApiOperation({ deprecated: true })
  async checkFileExistence(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) folderId: number,
    @Query('name') name: string,
    @Query('type') type: string,
  ) {
    if (folderId < 1 || !isNumber(folderId)) {
      throw new BadRequestWrongFolderIdException();
    }

    if (!name || !type) {
      throw new BadRequestException();
    }

    const files = await this.fileUseCases.getFiles(
      user.id,
      {
        folderId,
        status: FileStatus.EXISTS,
        plainName: name,
        type,
      },
      {
        limit: 1,
        offset: 0,
      },
    );

    const singleFile = files[0];

    if (!singleFile) {
      throw new NotFoundException();
    }

    return singleFile;
  }

  @Get('/content/:uuid/folders')
  @ApiOkResponse({ type: FoldersDto })
  async getFolderContentFolders(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Query() query: GetFoldersInFoldersDto,
  ): Promise<FoldersDto> {
    const folders = await this.folderUseCases.getFolders(
      user.id,
      {
        parentUuid: folderUuid,
        deleted: false,
        removed: false,
      },
      {
        limit: query.limit,
        offset: query.offset,
        sort: query.sort && query.order && [[query.sort, query.order]],
      },
    );

    return {
      folders: folders.map((f) => {
        return { ...f, status: f.getFolderStatus() };
      }),
    };
  }

  @Get('/content/:uuid/folders/existence')
  @ApiOperation({
    summary: 'Checks folders existence in folder (use POST request over this)',
    deprecated: true,
  })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @WorkspacesInBehalfValidationFolder()
  async checkFoldersExistenceInFolderOld(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Query() query: CheckFoldersExistenceOldDto,
  ) {
    const { plainName } = query;

    const folders = await this.folderUseCases.searchFoldersInFolder(
      user,
      folderUuid,
      {
        plainNames: plainName,
      },
    );

    return { existentFolders: folders };
  }

  @Post('/content/:uuid/folders/existence')
  @ApiOperation({
    summary: 'Checks folders existence in folder',
  })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @ApiOkResponse({ type: ExistentFoldersDto })
  @WorkspacesInBehalfValidationFolder()
  async checkFoldersExistenceInFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Body() query: CheckFoldersExistenceDto,
  ): Promise<ExistentFoldersDto> {
    const { plainNames } = query;

    const folders = await this.folderUseCases.searchFoldersInFolder(
      user,
      folderUuid,
      {
        plainNames,
      },
    );

    return {
      existentFolders: folders.map((folder) => ({
        ...folder,
        status: folder.getFolderStatus(),
      })),
    };
  }

  @Post('/content/:uuid/files/existence')
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @ApiOkResponse({ type: ExistentFilesDto })
  @WorkspacesInBehalfValidationFolder()
  async checkFilesExistenceInFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Body() query: CheckFileExistenceInFolderDto,
  ): Promise<ExistentFilesDto> {
    const parentFolder = await this.folderUseCases.getFolderByUuid(
      folderUuid,
      user,
    );

    if (!parentFolder) {
      throw new BadRequestException('Parent folder not valid!');
    }

    const files = await this.fileUseCases.searchFilesInFolder(
      parentFolder,
      query.files,
    );

    return { existentFiles: files };
  }

  @Get('/content/:uuid')
  @ApiOperation({
    summary: 'Gets folder content',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'uuid', type: String, required: true })
  @ApiOkResponse({
    description: 'Current folder with children folders and files',
    type: GetFolderContentDto,
  })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @WorkspacesInBehalfValidationFolder()
  async getFolderContent(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Query() query: BasicPaginationDto,
  ): Promise<GetFolderContentDto> {
    const [currentFolder, childrenFolders, files] = await Promise.all([
      this.folderUseCases.getFolderByUuid(folderUuid, user),
      this.folderUseCases.getFolders(
        user.id,
        {
          parentUuid: folderUuid,
          deleted: false,
          removed: false,
        },
        { limit: query.limit, offset: query.offset },
      ),
      this.fileUseCases.getFiles(
        user.id,
        {
          folderUuid: folderUuid,
          status: FileStatus.EXISTS,
        },
        { limit: query.limit, offset: query.offset },
      ),
    ]);

    if (!currentFolder) {
      throw new BadRequestException();
    }

    return {
      ...currentFolder,
      status: currentFolder.getFolderStatus(),
      children: childrenFolders.map((f) => ({
        ...f,
        status: f.getFolderStatus(),
      })),
      files,
    };
  }

  @Get(':id/folders')
  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: ResultFoldersDto })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  async getFolderFolders(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) folderId: number,
    @Query() query: GetFoldersInFoldersDto,
  ): Promise<ResultFoldersDto> {
    const folders = await this.folderUseCases.getFolders(
      user.id,
      {
        parentId: folderId,
        deleted: false,
        removed: false,
      },
      {
        limit: query.limit,
        offset: query.offset,
        sort: query.sort && query.order && [[query.sort, query.order]],
      },
    );

    return {
      result: folders.map((f) => ({
        ...f,
        status: f.getFolderStatus(),
      })),
    };
  }

  @UseGuards(CustomEndpointThrottleGuard)
  @CustomThrottle({
    short: { ttl: 60, limit: 60 },
  })
  @Get('/')
  @ApiOkResponse({ isArray: true, type: FolderDto })
  async getFolders(
    @UserDecorator() user: User,
    @Query() query: GetFoldersQueryDto,
  ): Promise<FolderDto[]> {
    try {
      const fns: Record<string, (...args) => Promise<Folder[]>> = {
        ALL: this.folderUseCases.getAllFoldersUpdatedAfter,
        EXISTS: this.folderUseCases.getNotTrashedFoldersUpdatedAfter,
        TRASHED: this.folderUseCases.getTrashedFoldersUpdatedAfter,
        DELETED: this.folderUseCases.getRemovedFoldersUpdatedAfter,
      };

      const sort =
        query.sort && query.order ? [[query.sort, query.order]] : undefined;

      const options = {
        limit: query.limit,
        offset: query.offset,
        sort,
      };

      const folders: Folder[] = await fns[query.status].bind(
        this.folderUseCases,
      )(user.id, new Date(query.updatedAt || 1), options);

      return folders.map((f) => {
        if (!f.plainName) {
          f.plainName = this.folderUseCases.decryptFolderName(f).plainName;
        }

        return { ...f, status: f.getFolderStatus() };
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
  @ApiOkResponse({ type: FolderDto })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @WorkspacesInBehalfValidationFolder()
  async getFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
  ): Promise<FolderDto> {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
    }

    const folder = await this.folderUseCases.getFolderByUuidAndUser(
      folderUuid,
      user,
    );

    if (!folder) {
      throw new NotFoundException();
    }

    return { ...folder, status: folder.getFolderStatus() };
  }

  @Get('/:uuid/stats')
  @ApiOperation({
    summary: 'Get folder statistics',
    description:
      'Calculates the total number of files and total size including all nested subfolders',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'Folder UUID',
  })
  @ApiOkResponse({ type: FolderStatsDto })
  @ApiBearerAuth()
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @WorkspacesInBehalfValidationFolder()
  async getFolderStats(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ): Promise<FolderStatsDto> {
    return this.folderUseCases.getFolderStats(user, uuid);
  }

  @Get('/:uuid/ancestors')
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @ApiQuery({
    name: 'workspace',
    description: 'If true, will return ancestors in workspace',
    type: Boolean,
  })
  @WorkspacesInBehalfValidationFolder()
  async getFolderAncestors(
    @UserDecorator() user: User,
    @WorkspaceDecorator() workspace: Workspace,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
  ) {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
    }

    return !workspace
      ? this.folderUseCases.getFolderAncestors(user, folderUuid)
      : this.folderUseCases.getFolderAncestorsInWorkspace(user, folderUuid);
  }

  @Get('/:uuid/tree')
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @ApiParam({ name: 'uuid', type: String, required: true })
  @WorkspacesInBehalfValidationFolder()
  async getFolderTree(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
  ) {
    const folderWithTree = await this.folderUseCases.getFolderTree(
      user,
      folderUuid,
    );
    return { tree: folderWithTree };
  }

  @Get('/:id/metadata')
  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: FolderDto })
  async getFolderById(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) folderId: number,
  ): Promise<FolderDto> {
    if (folderId < 0) {
      throw new BadRequestException('Invalid id provided');
    }

    const folder = await this.folderUseCases.getFolderByUserId(
      folderId,
      user.id,
    );

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return { ...folder, status: folder.getFolderStatus() };
  }

  @Put('/:uuid/meta')
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemId',
    },
    {
      fieldName: 'itemType',
      value: 'folder',
    },
  ])
  @ApiOkResponse({ type: FolderDto })
  @WorkspacesInBehalfValidationFolder()
  @RequiredSharingPermissions(SharingActionName.RenameItems)
  async updateFolderMetadata(
    @Param('uuid', ValidateUUIDPipe)
    folderUuid: string,
    @UserDecorator() user: User,
    @Body() updateFolderMetaDto: UpdateFolderMetaDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FolderDto> {
    const folderUpdated = await this.folderUseCases.updateFolderMetaData(
      user,
      folderUuid,
      updateFolderMetaDto,
    );

    const folderDto = {
      ...folderUpdated,
      status: folderUpdated.getFolderStatus(),
    };

    this.storageNotificationService.folderUpdated({
      payload: folderDto,
      user: requester,
      clientId,
    });

    return folderDto;
  }

  @Get(':uuid/size')
  async getFolderSize(@Param('uuid', ValidateUUIDPipe) folderUuid: string) {
    const size = await this.folderUseCases.getFolderSizeByUuid(folderUuid);

    return { size };
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
      value: 'folder',
    },
  ])
  @ApiOkResponse({ type: FolderDto })
  @WorkspacesInBehalfValidationFolder()
  async moveFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) folderUuid: string,
    @Body() moveFolderData: MoveFolderDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ): Promise<FolderDto> {
    const folder = await this.folderUseCases.moveFolder(
      user,
      folderUuid,
      moveFolderData,
    );

    const folderDto = { ...folder, status: folder.getFolderStatus() };

    this.storageNotificationService.folderUpdated({
      payload: folderDto,
      user: requester,
      clientId,
    });

    return folderDto;
  }

  @UseGuards(CustomEndpointThrottleGuard)
  @CustomThrottle({
    short: { ttl: 60, limit: 30 },
  })
  @Get('/meta')
  async getFolderMetaByPath(
    @UserDecorator() user: User,
    @Query('path') folderPath: string,
  ) {
    if (!folderPath || folderPath.length === 0 || !folderPath.includes('/')) {
      throw new BadRequestException('Invalid path provided');
    }

    if (getPathDepth(folderPath) > 20) {
      throw new BadRequestException('Path is too deep');
    }

    const folder = await this.folderUseCases.getFolderMetadataByPath(
      user,
      folderPath,
    );
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  @Delete('/:uuid')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete Folder',
  })
  async deleteFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Client() clientId: string,
  ) {
    const folder = await this.folderUseCases.getFolderByUuidAndUser(uuid, user);
    await this.folderUseCases.deleteNotRootFolderByUser(user, [folder]);
    this.storageNotificationService.folderDeleted({
      payload: { id: folder.id, uuid, userId: user.id },
      user: user,
      clientId,
    });
  }
}
