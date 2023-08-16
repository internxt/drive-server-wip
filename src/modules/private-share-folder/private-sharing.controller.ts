import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  Delete,
  ParseUUIDPipe,
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
  InvitedUserNotFoundError,
  OwnerCannotBeSharedWithError,
  UserAlreadyHasRole,
  InvalidSharedFolderError,
  FolderNotSharedWithUserError,
  OwnerCannotBeRemovedWithError,
} from './private-sharing.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Folder } from '../folder/folder.domain';
import { File } from '../file/file.domain';
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

  @Delete('stop/folder-id/:folderId')
  @ApiParam({
    name: 'folderId',
    description: 'Folder id of the shared folder',
    type: String,
  })
  @ApiOperation({
    summary: 'Stop sharing one folder',
  })
  @ApiOkResponse({ description: 'Folder stopped sharing' })
  @ApiBearerAuth()
  async stopSharing(
    @Param('folderId', ParseUUIDPipe) folderUuid: Folder['uuid'],
    @UserDecorator() user: User,
  ): Promise<{ message: string }> {
    try {
      await this.privateSharingUseCase.stopSharing(folderUuid, user);

      return { message: 'Folder stopped sharing' };
    } catch (error) {
      if (error instanceof InvalidOwnerError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof FolderNotSharedError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof ForbiddenException) {
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

  @Delete('shared-with/folder-id/:folderId/user-id/:userId')
  @ApiParam({
    name: 'userId',
    description: 'User id to remove from the shared folder',
    type: String,
  })
  @ApiParam({
    name: 'folderId',
    description: 'Folder id of the shared folder to remove the user from',
    type: String,
  })
  @ApiOperation({
    summary: 'Remove user from shared folder',
  })
  @ApiOkResponse({ description: 'User removed from shared folder' })
  @ApiBearerAuth()
  async removUserFromSharedFolder(
    @Param('folderId', ParseUUIDPipe) folderUuid: Folder['uuid'],
    @Param('userId', ParseUUIDPipe) userUuid: User['uuid'],
    @UserDecorator() user: User,
  ): Promise<{ message: string }> {
    try {
      await this.privateSharingUseCase.removeSharedWith(
        folderUuid,
        userUuid,
        user,
      );

      return { message: 'User removed from shared folder' };
    } catch (error) {
      if (error instanceof InvalidOwnerError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof OwnerCannotBeRemovedWithError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof FolderNotSharedWithUserError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof ForbiddenException) {
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
  @Post('/share')
  @ApiOperation({
    summary: 'Share folder to a user',
  })
  @ApiOkResponse({ description: 'Share folder to a user' })
  @ApiBearerAuth()
  async createPrivateFolder(
    @UserDecorator() user: User,
    @Body() CreatePrivateSharingDto: CreatePrivateSharingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.privateSharingUseCase.createPrivateSharingFolder(
        user,
        CreatePrivateSharingDto.folderId,
        CreatePrivateSharingDto.email,
        CreatePrivateSharingDto.encryptionKey,
        CreatePrivateSharingDto.roleId,
      );

      return { message: 'Private folder created' };
    } catch (error) {
      if (error instanceof InvitedUserNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof OwnerCannotBeSharedWithError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof UserAlreadyHasRole) {
        throw new ConflictException(error.message);
      }

      if (error instanceof ForbiddenException) {
        throw error;
      }

      new Logger().error(
        `[PRIVATESHARING/CREATE] Error: while creating private folder by user ${
          user.uuid
        }, ${error.stack || 'No stack trace'}`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      return { error: 'Internal Server Error' };
    }
  }

  @Get('/roles')
  @ApiOperation({
    summary: 'Get all roles of private sharing',
  })
  @ApiOkResponse({ description: 'Get all roles of private sharing' })
  @ApiBearerAuth()
  async getAllRoles(
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<'roles', PrivateSharingRole[]>> {
    try {
      return {
        roles: await this.privateSharingUseCase.getAllRoles(),
      };
    } catch (error) {
      new Logger().error(
        `[PRIVATESHARING/GETALLROLES] Error: while getting all roles, ${
          error.stack || 'No stack trace'
        }`,
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      throw error;
    }
  }

  @Get('items/:sharedFolderId')
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
    name: 'sharedFolderId',
    description: 'Folder id of the shared folder',
    type: String,
  })
  @ApiQuery({
    name: 'token',
    description: 'Token that authorizes the access to the shared content',
    type: String,
  })
  @ApiOkResponse({ description: 'Get all items inside a shared folder' })
  @ApiBearerAuth()
  async getPrivateShareItems(
    @UserDecorator() user: User,
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Res({ passthrough: true }) res: Response,
    @Query('orderBy') orderBy: OrderBy,
    @Query('token') token: string,
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
        sharedFolderId,
        token,
        user,
        page,
        perPage,
        order,
      );
    } catch (error) {
      let errorMessage = error.message;

      if (error instanceof ForbiddenException) {
        throw error;
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

  @Get('shared-with/:folderId')
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
    @Param('folderId') folderId: Folder['uuid'],
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<'users', any[]> | Record<'error', string>> {
    try {
      const { offset, limit } = Pagination.calculatePagination(page, perPage);

      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      const users = await this.privateSharingUseCase.getSharedWithByFolderId(
        user,
        folderId,
        offset,
        limit,
        order,
      );

      return { users };
    } catch (error) {
      let errorMessage = error.message;

      if (error instanceof InvalidSharedFolderError) {
        res.status(HttpStatus.BAD_REQUEST);
      } else if (error instanceof UserNotInvitedError) {
        res.status(HttpStatus.FORBIDDEN);
      } else {
        Logger.error(
          `[PRIVATESHARING/GETSHAREDBY] Error while getting shared with by folder ${
            user.uuid
          }, ${error.stack || 'No stack trace'}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal server error';
      }
      return { error: errorMessage };
    }
  }
}
