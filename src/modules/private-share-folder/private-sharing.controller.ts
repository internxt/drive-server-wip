import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  InvalidChildFolderError,
  InvalidOwnerError,
  InvalidPrivateFolderRoleError,
  InvalidRoleError,
  PrivateSharingUseCase,
} from './private-sharing.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Folder } from '../folder/folder.domain';
import { File } from '../file/file.domain';
import { User } from '../user/user.domain';
import { OrderBy } from 'src/common/order.type';
import { Pagination } from 'src/lib/pagination';
import { Response } from 'express';
import { GrantPrivilegesDto } from './dto/grant-privileges.dto';
import { UpdatePrivilegesDto } from './dto/update-privilages.dto';
import { isInstance } from 'class-validator';
import { PrivateSharingFolder } from './private-sharing-folder.domain';

@ApiTags('Private Sharing')
@Controller('private-sharing')
export class PrivateSharingController {
  constructor(private readonly privateSharingUseCase: PrivateSharingUseCase) {}

  @Post('grant-privileges')
  @ApiOperation({
    summary: 'Grant privileges to a user on a folder',
  })
  @ApiOkResponse({ description: 'Grant privileges to a user on a folder' })
  @ApiBearerAuth()
  async grantPrivileges(
    @UserDecorator() user: User,
    @Body() dto: GrantPrivilegesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.privateSharingUseCase.grantPrivileges(
        user,
        dto.userUuid,
        dto.privateFolderId,
        dto.roleId,
      );

      return {
        message: 'Privileges granted',
      };
    } catch (error) {
      let errorMessage = error.message;

      if (error instanceof InvalidOwnerError) {
        res.status(HttpStatus.FORBIDDEN);
      } else {
        new Logger().error(
          `[PRIVATESHARING/GRANTACCESS] ERROR: ${
            (error as Error).message
          }, BODY ${JSON.stringify(dto)}, STACK: ${(error as Error).stack}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }
      return { error: errorMessage };
    }
  }

  @Put('update-role/:privateFolderRoleId')
  @ApiOperation({
    summary: 'Update role of a user on a folder',
  })
  @ApiOkResponse({ description: 'Update role of a user on a folder' })
  @ApiBearerAuth()
  async updateRole(
    @Param('privateFolderRoleId') privateFolderRoleId: string,
    @UserDecorator() user: User,
    @Body() dto: UpdatePrivilegesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.privateSharingUseCase.updateRole(
        user,
        privateFolderRoleId,
        dto.roleId,
      );

      return {
        message: 'Role updated',
      };
    } catch (error) {
      let errorMessage = error.message;

      if (error instanceof InvalidOwnerError) {
        res.status(HttpStatus.FORBIDDEN);
      } else if (error instanceof InvalidRoleError) {
        res.status(HttpStatus.BAD_REQUEST);
      } else {
        new Logger().error(
          `[PRIVATESHARING/UPDATEROLE] ERROR: ${
            (error as Error).message
          }, BODY ${JSON.stringify(dto)}, STACK: ${(error as Error).stack}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @Get('receive/folders')
  @ApiOperation({
    summary: 'Get all folders shared with a user',
  })
  @ApiQuery({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Get all folders shared with a user' })
  @ApiBearerAuth()
  async getSharedFoldersWithAUser(
    @UserDecorator() user: User,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
    @Query('orderBy') orderBy: OrderBy,
  ): Promise<Record<'folders', Folder[]>> {
    try {
      const { offset, limit } = Pagination.calculatePagination(page, perPage);

      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return {
        folders: await this.privateSharingUseCase.getSharedFoldersBySharedWith(
          user,
          offset,
          limit,
          order,
        ),
      };
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[PRIVATESHARING/GETSHAREDWITH] Error while getting shared folders with user ${
          user.uuid
        }, ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('sent/folders')
  @ApiOperation({
    summary: 'Get all folders shared by a user',
  })
  @ApiQuery({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Get all folders shared by a user' })
  @ApiBearerAuth()
  async getSharedFolders(
    @UserDecorator() user: User,
    @Query('orderBy') orderBy: OrderBy,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<Record<'folders', Folder[]>> {
    try {
      const { offset, limit } = Pagination.calculatePagination(page, perPage);

      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return {
        folders: await this.privateSharingUseCase.getSharedFoldersByOwner(
          user,
          offset,
          limit,
          order,
        ),
      };
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[PRIVATESHARING/GETSHAREDBY] Error while getting shared folders by user ${
          user.uuid
        }, ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('items/:parentPrivateSharingFolderId/:folderId')
  @ApiOperation({
    summary: 'Get all items shared by a user',
  })
  @ApiQuery({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Get all items shared by a user' })
  @ApiBearerAuth()
  async getSharedItems(
    @UserDecorator() user: User,
    @Param('privateSharingFolderId')
    parentPrivateSharingFolderId: PrivateSharingFolder['id'],
    @Param('folderId') folderId: Folder['id'],
    @Res({ passthrough: true }) res: Response,
    @Query('orderBy') orderBy: OrderBy,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<
    { folders: Folder[] | []; files: File[] | [] } | { error: string }
  > {
    try {
      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return this.privateSharingUseCase.getItems(
        parentPrivateSharingFolderId,
        folderId,
        user,
        page,
        perPage,
        order,
      );
    } catch (error) {
      let errorMessage = error.message;

      if (error instanceof InvalidPrivateFolderRoleError) {
        res.status(HttpStatus.FORBIDDEN);
      } else if (error instanceof InvalidChildFolderError) {
        res.status(HttpStatus.BAD_REQUEST);
      } else {
        Logger.error(
          `[PRIVATESHARING/GETSHAREDBY] Error while getting shared folders by user ${
            user.uuid
          }, message: ${error.message}, ${error.stack || 'No stack trace'}`,
        );

        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }
}
