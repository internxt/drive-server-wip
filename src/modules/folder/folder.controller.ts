import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
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
import { Folder, SortableFolderAttributes } from './folder.domain';
import { FileStatus, SortableFileAttributes } from '../file/file.domain';
import logger from '../../externals/logger';
import { validate } from 'uuid';
import { HttpExceptionFilter } from '../../lib/http/http-exception.filter';
import { isNumber } from '../../lib/validators';
import { MoveFolderDto } from './dto/move-folder.dto';

import { ValidateUUIDPipe } from '../workspaces/pipes/validate-uuid.pipe';
import { UpdateFolderMetaDto } from './dto/update-folder-meta.dto';
import { WorkspacesInBehalfValidationFolder } from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CheckFoldersExistenceDto } from './dto/folder-existence-in-folder.dto';
import { InvalidParentFolderException } from './exception/invalid-parent-folder';
import { CheckFileExistenceInFolderDto } from './dto/files-existence-in-folder.dto';
import { RequiredSharingPermissions } from '../sharing/guards/sharing-permissions.decorator';
import { SharingActionName } from '../sharing/sharing.domain';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Client } from '../auth/decorators/client.decorator';
import { BasicPaginationDto } from '../../common/dto/basic-pagination.dto';
import { Workspace } from '../workspaces/domains/workspaces.domain';
import { getPathDepth } from '../../lib/path';
import { CheckFoldersExistenceOldDto } from './dto/folder-existence-in-folder-old.dto';
import { Requester } from '../auth/decorators/requester.decorator';
import {
  ExistingFoldersDto,
  FolderDto,
  FoldersDto,
  ResultFoldersDto,
} from './dto/responses/folder.dto';
import { FilesDto, ResultFilesDto } from '../file/dto/responses/file.dto';
import { GetFolderContentDto } from './dto/responses/get-folder-content.dto';

const foldersStatuses = ['ALL', 'EXISTS', 'TRASHED', 'DELETED'] as const;

enum FolderStatusQuery {
  EXISTS = 'EXISTS',
  TRASHED = 'TRASHED',
  DELETED = 'DELETED',
  ALL = 'ALL',
}

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
    private readonly storageNotificationService: StorageNotificationService,
  ) {}

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

    this.storageNotificationService.folderCreated({
      payload: folder,
      user: requester,
      clientId,
    });

    return { ...folder, status: folder.getFolderStatus() };
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
    @Param('uuid') folderUuid: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('sort') sort?: SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<FilesDto> {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
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
        folderUuid,
        status: FileStatus.EXISTS,
      },
      {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
      },
    );

    return { files };
  }

  @Get(':id/files')
  @ApiOkResponse({ type: ResultFilesDto })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  async getFolderFiles(
    @UserDecorator() user: User,
    @Param('id') folderId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('sort') sort?: SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<ResultFilesDto> {
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

    if (order && order !== 'ASC' && order !== 'DESC') {
      throw new BadRequestException('Invalid order parameter');
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

  @Get(':id/file')
  async checkFileExistence(
    @UserDecorator() user: User,
    @Param('id') folderId: number,
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
    @Param('uuid') folderUuid: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('sort') sort?: SortableFolderAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<FoldersDto> {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
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
        parentUuid: folderUuid,
        deleted: false,
        removed: false,
      },
      {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
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
    @Param('uuid') folderUuid: string,
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
  @ApiOkResponse({ type: ExistingFoldersDto })
  @WorkspacesInBehalfValidationFolder()
  async checkFoldersExistenceInFolder(
    @UserDecorator() user: User,
    @Param('uuid') folderUuid: string,
    @Body() query: CheckFoldersExistenceDto,
  ): Promise<ExistingFoldersDto> {
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
  @WorkspacesInBehalfValidationFolder()
  async checkFilesExistenceInFolder(
    @UserDecorator() user: User,
    @Param('uuid') folderUuid: string,
    @Body() query: CheckFileExistenceInFolderDto,
  ) {
    const parentFolder = await this.folderUseCases.getFolderByUuid(
      folderUuid,
      user,
    );

    if (!parentFolder) {
      throw new InvalidParentFolderException('Parent folder not valid!');
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
  @ApiOkResponse({ type: ResultFoldersDto })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  async getFolderFolders(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('id') folderId: number,
    @Query('sort') sort?: SortableFolderAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<ResultFoldersDto> {
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
        removed: false,
      },
      {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
      },
    );

    return {
      result: folders.map((f) => ({
        ...f,
        status: f.getFolderStatus(),
      })),
    };
  }

  @Get('/')
  @ApiOkResponse({ isArray: true, type: FolderDto })
  @ApiQuery({ name: 'updatedAt', required: false })
  @ApiQuery({ name: 'status', enum: FolderStatusQuery })
  @ApiQuery({ name: 'offset', type: Number })
  @ApiQuery({ name: 'limit', type: Number })
  async getFolders(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: FolderStatusQuery,
    @Query('updatedAt') updatedAt?: string,
  ): Promise<FolderDto[]> {
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
    @Param('uuid') folderUuid: string,
  ): Promise<FolderDto> {
    if (!validate(folderUuid)) {
      throw new BadRequestException('Invalid UUID provided');
    }

    try {
      const folder = await this.folderUseCases.getFolderByUuidAndUser(
        folderUuid,
        user,
      );

      if (!folder) {
        throw new NotFoundException();
      }

      return { ...folder, status: folder.getFolderStatus() };
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
    @Param('uuid') folderUuid: Folder['uuid'],
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
  @WorkspacesInBehalfValidationFolder()
  async getFolderTree(
    @UserDecorator() user: User,
    @Param('uuid') folderUuid: Folder['uuid'],
  ) {
    const folderWithTree = await this.folderUseCases.getFolderTree(
      user,
      folderUuid,
    );
    return { tree: folderWithTree };
  }

  @Get('/:id/metadata')
  @ApiOkResponse({ type: FolderDto })
  async getFolderById(
    @UserDecorator() user: User,
    @Param('id') folderId: number,
  ): Promise<FolderDto> {
    if (folderId < 0) {
      throw new BadRequestException('Invalid id provided');
    }

    try {
      const folder = await this.folderUseCases.getFolderByUserId(
        folderId,
        user.id,
      );

      return { ...folder, status: folder.getFolderStatus() };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      logger('error', {
        id: 'get-folder-by-id',
        user: user.uuid,
        message: `Error getting folder ${err.message}. STACK ${
          err.stack || 'NO STACK'
        }`,
      });
    }
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
  @WorkspacesInBehalfValidationFolder()
  @RequiredSharingPermissions(SharingActionName.RenameItems)
  async updateFolderMetadata(
    @Param('uuid', ValidateUUIDPipe)
    folderUuid: string,
    @UserDecorator() user: User,
    @Body() updateFolderMetaDto: UpdateFolderMetaDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ) {
    const folderUpdated = await this.folderUseCases.updateFolderMetaData(
      user,
      folderUuid,
      updateFolderMetaDto,
    );

    this.storageNotificationService.folderUpdated({
      payload: folderUpdated,
      user: requester,
      clientId,
    });

    return folderUpdated;
  }

  @UseFilters(new HttpExceptionFilter())
  @Get(':uuid/size')
  async getFolderSize(@Param('uuid') folderUuid: Folder['uuid']) {
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
  @WorkspacesInBehalfValidationFolder()
  async moveFolder(
    @UserDecorator() user: User,
    @Param('uuid') folderUuid: string,
    @Body() moveFolderData: MoveFolderDto,
    @Client() clientId: string,
    @Requester() requester: User,
  ) {
    if (!validate(folderUuid) || !validate(moveFolderData.destinationFolder)) {
      throw new BadRequestException('Invalid UUID provided');
    }
    const folder = await this.folderUseCases.moveFolder(
      user,
      folderUuid,
      moveFolderData.destinationFolder,
    );

    this.storageNotificationService.folderUpdated({
      payload: folder,
      user: requester,
      clientId,
    });

    return folder;
  }

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
    await this.folderUseCases.deleteByUser(user, [folder]);
    this.storageNotificationService.folderDeleted({
      payload: { id: folder.id, uuid, userId: user.id },
      user: user,
      clientId,
    });
  }
}
