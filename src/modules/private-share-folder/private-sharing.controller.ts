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
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  InvalidChildFolderError,
  InvalidOwnerError,
  InvalidPrivateFolderRoleError,
  RoleNotFoundError,
  PrivateSharingUseCase,
  UserNotInvitedError,
} from './private-sharing.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Folder } from '../folder/folder.domain';
import { File } from '../file/file.domain';
import { User } from '../user/user.domain';
import { OrderBy } from '../../common/order.type';
import { Pagination } from '../../lib/pagination';
import { Response } from 'express';
import { GrantPrivilegesDto } from './dto/grant-privileges.dto';
import { UpdatePrivateSharingFolderRoleDto } from './dto/update-private-sharing-folder-role.dto';
import { PrivateSharingRole } from './private-sharing-role.domain';
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

  @Put('role/:id')
  @ApiOperation({
    summary: 'Update role of a user on a folder',
  })
  @ApiOkResponse({ description: 'Update role of a user on a folder' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: 'Role id',
    type: String,
  })
  async updateRole(
    @Param('id') id: PrivateSharingRole['id'],
    @UserDecorator() user: User,
    @Body() dto: UpdatePrivateSharingFolderRoleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.privateSharingUseCase.updateRole(
        user,
        dto.userId,
        dto.folderId,
        id,
      );

      return {
        message: 'Role updated',
      };
    } catch (error) {
      let errorMessage = error.message;

      if (
        error instanceof InvalidOwnerError ||
        error instanceof UserNotInvitedError
      ) {
        res.status(HttpStatus.FORBIDDEN);
      } else if (error instanceof RoleNotFoundError) {
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

  @Get('shared-with-me/folders')
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

  @Get('shared-by-me/folders')
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

  @Get('/folders')
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
  @ApiOkResponse({ description: 'Get all folders shared by/with a user' })
  @ApiBearerAuth()
  async getAllSharedFolders(
    @UserDecorator() user: User,
    @Query('orderBy') orderBy: OrderBy,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<Record<'sharedByMe' | 'sharedWithMe', Folder[]>> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return {
      sharedByMe: await this.privateSharingUseCase.getSharedFoldersByOwner(
        user,
        offset,
        limit,
        order,
      ),

      sharedWithMe:
        await this.privateSharingUseCase.getSharedFoldersBySharedWith(
          user,
          offset,
          limit,
          order,
        ),
    };
  }

  @Get('items/shared-folder-id/:sharedFolderId/child-folder-id/:childFolderId')
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
  @ApiParam({
    name: 'childFolderId',
    description:
      'folder id about which you need to know the items, this folder must be the "shared folder" or a child of this.',
    type: String,
  })
  @ApiParam({
    name: 'sharedFolderId',
    description: 'Folder id of the shared folder',
    type: String,
  })
  @ApiOkResponse({ description: 'Get all items shared by a user' })
  @ApiBearerAuth()
  async getSharedItems(
    @UserDecorator() user: User,
    @Param('childFolderId') childFolderId: Folder['uuid'],
    @Param('sharedFolder') sharedFolderId: Folder['uuid'],
    @Query('orderBy') orderBy: OrderBy,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    { folders: Folder[] | []; files: File[] | [] } | { error: string }
  > {
    try {
      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return this.privateSharingUseCase.getItems(
        childFolderId,
        sharedFolderId,
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
