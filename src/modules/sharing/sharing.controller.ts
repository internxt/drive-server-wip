import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
  Res,
  Query,
  ForbiddenException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import {
  InvalidSharedFolderError,
  SharingService,
  UserNotInvitedError,
} from './sharing.service';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Sharing, SharingInvite, SharingRole } from './sharing.domain';
import { UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Folder } from '../folder/folder.domain';
import {
  GetFilesResponse,
  GetFoldersReponse,
  GetItemsReponse,
} from './dto/get-items-and-shared-folders.dto';
import { OrderBy } from '../../common/order.type';
import { Pagination } from '../../lib/pagination';

@Controller('sharings')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('/:itemType/:itemId/invites')
  getInvites(
    @UserDecorator() user: User,
    @Param('itemType') itemType: string,
    @Param('itemId') itemId: string,
  ) {
    if (itemType !== 'file' && itemType !== 'folder') {
      throw new BadRequestException('Invalid item type');
    }
    return this.sharingService.getInvites(user, itemType, itemId);
  }

  @Post('/invites/send')
  createInvite(
    @UserDecorator() user: User,
    @Body() createInviteDto: CreateInviteDto,
  ) {
    // TODO: Validate params;
    return this.sharingService.createInvite(user, createInviteDto);
  }

  @Post('/invites/:id/accept')
  async acceptInvite(
    @UserDecorator() user,
    @Body() acceptInviteDto: AcceptInviteDto,
    @Param('id') inviteId: SharingInvite['id'],
  ) {
    await this.sharingService.acceptInvite(user, inviteId, acceptInviteDto);
  }

  @Delete('/invites/:id')
  @ApiParam({
    name: 'id',
    description: 'Id of the invitation to accept',
    type: String,
  })
  async removeInvite(
    @UserDecorator() user,
    @Param('id') id: SharingInvite['id'],
  ) {
    await this.sharingService.removeInvite(user, id);
  }

  @Get('/items/:sharedFolderId/folders')
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
  async getSharedFoldersInsideSharedFolder(
    @UserDecorator() user: User,
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Res({ passthrough: true }) res: Response,
    @Query('orderBy') orderBy: OrderBy,
    @Query('token') token: string,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ) {
    try {
      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return this.sharingService.getFolders(
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
          `[SHARING/LIST-FOLDERS] Error while getting shared folders by user ${
            user.uuid
          }, message: ${error.message}, ${error.stack || 'No stack trace'}`,
        );

        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @Get('items/:sharedFolderId/files')
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
  async getPrivateShareFiles(
    @UserDecorator() user: User,
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Res({ passthrough: true }) res: Response,
    @Query('orderBy') orderBy: OrderBy,
    @Query('token') token: string,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<GetFilesResponse | { error: string }> {
    try {
      const order = orderBy
        ? [orderBy.split(':') as [string, string]]
        : undefined;

      return this.sharingService.getFiles(
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

  @Delete('/:id')
  removeSharing(@UserDecorator() user: User, @Param('id') id: string) {
    return this.sharingService.removeSharing(user, id);
  }

  /**
   * PERMISSIONS
   */
  @Get('/roles')
  getRoles() {
    return this.sharingService.getRoles();
  }

  @Get('/:sharingId/role')
  getUserRole(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
  ) {
    return this.sharingService.getUserRole(sharingId, user);
  }

  @Put('/:id/roles/:sharingRoleId')
  @ApiParam({
    name: 'id',
    description: 'Id of the sharing whose role is going to be updated',
    type: String,
  })
  @ApiParam({
    name: 'sharingRoleId',
    description: 'Id of the sharing role whose role is going to be updated',
    type: String,
  })
  updateSharingRole(
    @UserDecorator() user: User,
    @Param('sharingRoleId') sharingRoleId: SharingRole['id'],
    @Body() dto: UpdateSharingRoleDto,
  ) {
    return this.sharingService.updateSharingRole(user, sharingRoleId, dto);
  }

  @Delete('/:sharingId/roles/:sharingRoleId')
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing whose sharing role is going to be deleted',
    type: String,
  })
  @ApiParam({
    name: 'sharingRoleId',
    description: 'Id of the sharing role to be deleted',
    type: String,
  })
  removeSharingRole(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
    @Param('sharingRoleId') sharingRoleId: SharingRole['id'],
  ) {
    return this.sharingService.removeSharingRole(user, sharingRoleId);
  }

  // ======================

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
        folders: await this.sharingService.getSharedFoldersBySharedWith(
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
        folders: await this.sharingService.getSharedFoldersByOwner(
          user,
          offset,
          limit,
          order,
        ),
      };
    } catch (error) {
      const err = error as Error;
      Logger.error(
        `[SHARING/GET_SHARED_BY] Error while getting shared folders by user ${
          user.uuid
        }, ${err.stack || 'No stack trace'}`,
      );

      throw error;
    }
  }

  @Get('/folders')
  @ApiOperation({
    summary: 'Get all folders shared by/with a user',
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
  ): Promise<GetItemsReponse | { error: string }> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.sharingService.getSharedFolders(user, offset, limit, order);
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

      const users = await this.sharingService.getSharedWithByItemId(
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
