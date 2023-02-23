import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FolderUseCases } from './folder.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from '../file/file.usecase';

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
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('id') folderId: number,
  ) {
    if (folderId === 0 || Number.isNaN(folderId)) {
      throw new BadRequestException('Folder id should be a number higher than 0');
    }

    if (Number.isNaN(limit) || Number.isNaN(offset)) {
      throw new BadRequestException('Limit and offset should be numbers');
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit should be between 1 and 50');
    }

    if (offset < 0) {
      throw new BadRequestException('Offset should be higher than 0');
    }

    const files = await this.fileUseCases.getFilesByFolderId(
      folderId,
      user.id,
      {
        limit,
        offset,
        deleted: false,
      }
    );

    return { result: files };
  }

  @Get(':id/folders')
  async getFolderFolders(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('id') folderId: number,
  ) {
    if (folderId === 0 || Number.isNaN(folderId)) {
      throw new BadRequestException('Folder id should be a number higher than 0');
    }

    if (Number.isNaN(limit) || Number.isNaN(offset)) {
      throw new BadRequestException('Limit and offset should be numbers');
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit should be between 1 and 50');
    }

    if (offset < 0) {
      throw new BadRequestException('Offset should be higher than 0');
    }
  
    const folders = await this.folderUseCases.getFoldersByParentId(
      folderId,
      user.id,
      {
        limit,
        offset,
        deleted: false,
      }
    );

    return { result: folders };
  }
}
