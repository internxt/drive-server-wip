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
  Delete,
  ParseUUIDPipe,
  NotFoundException,
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
  FolderNotSharedError,
  InvalidOwnerError,
  RoleNotFoundError,
  PrivateSharingUseCase,
  UserNotInvitedError,
  UserNotInSharedFolder,
} from './private-sharing.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { OrderBy } from '../../common/order.type';
import { Pagination } from '../../lib/pagination';
import { Response } from 'express';
import { GrantPrivilegesDto } from './dto/grant-privileges.dto';
import { CreatePrivateSharingDto } from './dto/create-private-sharing.dto';
import { UpdatePrivateSharingFolderRoleDto } from './dto/update-private-sharing-folder-role.dto';
import { PrivateSharingRole } from './private-sharing-role.domain';

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
        dto.email,
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

  @Get('shared-with/by-folder-id/:folderId')
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Get all users that have access to a folder',
  })
  @ApiOperation({
    summary: 'Get all users that have access to a folder',
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
  async getSharedWithByFolderId(
    @UserDecorator() user: User,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
    @Query('orderBy') orderBy: OrderBy,
    @Param('folderId') folderId: string,
  ): Promise<Record<'users', User[]>> {
    try {
      const { offset, limit } = Pagination.calculatePagination(page, perPage);

      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return {
        users: await this.privateSharingUseCase.getSharedWithByFolderId(
          user,
          folderId,
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

  @Post('/create')
  @ApiOperation({
    summary: 'Create a private folder',
  })
  @ApiOkResponse({ description: 'Create a private folder' })
  @ApiBearerAuth()
  async createPrivateFolder(
    @UserDecorator() user: User,
    @Body() CreatePrivateSharingDto: CreatePrivateSharingDto,
  ) {
    try {
      const privateSharingFolder =
        await this.privateSharingUseCase.createPrivateSharingFolder(
          user,
          CreatePrivateSharingDto.folderId,
          CreatePrivateSharingDto.email,
          CreatePrivateSharingDto.encryptionKey,
        );

      await this.privateSharingUseCase.grantPrivileges(
        user,
        privateSharingFolder.sharedWith,
        privateSharingFolder.id,
        CreatePrivateSharingDto.roleId,
      );
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[PRIVATESHARING/CREATE] Error while creating private folder by user ${
          user.uuid
        }, ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('/by-folder-id/:folderId')
  @ApiOperation({
    summary: 'Get Private Shared folder by folder id',
  })
  @ApiOkResponse({ description: 'Get Private Shared folder by folder id' })
  @ApiBearerAuth()
  async getPrivateSharedFolderByFolderId(
    @UserDecorator() user: User,
    @Param('folderId') folderId: string,
  ) {
    try {
      console.log({ byfolderidfolderId: folderId });
      return {
        data: await this.privateSharingUseCase.getPrivateSharedFolderByFolderId(
          user,
          folderId,
        ),
      };
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[PRIVATESHARING/GETBYFOLDERID] Error while getting private shared folder by folder id ${
          user.uuid
        }, ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('/roles')
  @ApiOperation({
    summary: 'Get all roles',
  })
  @ApiOkResponse({ description: 'Get all roles' })
  @ApiBearerAuth()
  async getAllRoles(): Promise<Record<'roles', PrivateSharingRole[]>> {
    try {
      return {
        roles: await this.privateSharingUseCase.getAllRoles(),
      };
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[PRIVATESHARING/GETALLROLES] Error while getting all roles, ${
          err.stack || 'No stack trace'
        }`,
      );

      throw error;
    }
  }
  @Delete('stop/folder-id/:folderId')
  @ApiOperation({
    summary: 'Stop sharing one folder',
  })
  @ApiBearerAuth()
  async stopSharing(
    @Param('folderId', ParseUUIDPipe) folderUuid: string,
    @UserDecorator() user: User,
  ): Promise<any> {
    try {
      return await this.privateSharingUseCase.stopSharing(folderUuid);
    } catch (error) {
      if (
        error instanceof FolderNotSharedError ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      new Logger().error(
        `[PRIVATESHARING/STOP] ERROR: ${
          (error as Error).message
        }, Error while stopping shared folder by folder ${folderUuid}, ${
          error.stack || 'No stack trace'
        }`,
      );
    }
  }

  @Delete('remove/folder-id/:folderId/user-id/:userId')
  @ApiOperation({
    summary: 'Remove user from shared folder',
  })
  @ApiBearerAuth()
  async removUserFromSharedFolder(
    @Param('folderId', ParseUUIDPipe) folderUuid: string,
    @Param('userId', ParseUUIDPipe) userUuid: string,
    @UserDecorator() user: User,
  ): Promise<any> {
    try {
      return await this.privateSharingUseCase.removeUserShared(
        folderUuid,
        userUuid,
      );
    } catch (error) {
      if (
        error instanceof UserNotInSharedFolder ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      new Logger().error(
        `[PRIVATESHARING/REMOVE] ERROR: ${
          (error as Error).message
        }, Error while stopping shared folder by folder 
        ${folderUuid} and by shared user ${userUuid}, ${
          error.stack || 'No stack trace'
        }`,
      );
    }
  }
}
