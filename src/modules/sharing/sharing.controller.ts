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
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import {
  InvalidSharedFolderError,
  SharingService,
  UserNotInvitedError,
} from './sharing.service';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Item, Sharing, SharingInvite, SharingRole } from './sharing.domain';
import { UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Folder } from '../folder/folder.domain';
import {
  GetFilesResponse,
  GetItemsReponse,
} from './dto/get-items-and-shared-folders.dto';
import { OrderBy } from '../../common/order.type';
import { Pagination } from '../../lib/pagination';
import API_LIMITS from '../../lib/http/limits';
import { BadRequestParamOutOfRangeException } from '../../lib/http/errors';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSharingDto } from './dto/create-sharing.dto';

@Controller('sharings')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('/:sharingId/meta')
  @Public()
  @ApiOperation({
    summary: 'Get sharing metadata',
  })
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing',
    type: String,
  })
  @ApiOkResponse({ description: 'Get sharing metadata' })
  async getPublicSharing(
    @Param('sharingId') sharingId: Sharing['id'],
    @Query('code') code: string,
  ) {
    if (!code) {
      throw new BadRequestException('Code is required');
    }
    return this.sharingService.getPublicSharingById(sharingId, code);
  }

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

  @Get('/invites')
  @ApiOperation({
    summary: 'Get all the invites that a user has received',
  })
  @ApiQuery({
    description: 'Number of items to request',
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Offset from to start requesting items',
    name: 'offset',
    required: false,
    type: Number,
  })
  @ApiResponse({
    description: 'Get all the invites that a user has received',
  })
  async getInvitesByUser(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
  ) {
    if (
      limit < API_LIMITS.SHARING.GET.INVITATIONS.LIMIT.LOWER_BOUND ||
      limit > API_LIMITS.SHARING.GET.INVITATIONS.LIMIT.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'limit',
        API_LIMITS.SHARING.GET.INVITATIONS.LIMIT.LOWER_BOUND,
        API_LIMITS.SHARING.GET.INVITATIONS.LIMIT.UPPER_BOUND,
      );
    }

    if (
      offset < API_LIMITS.SHARING.GET.INVITATIONS.OFFSET.LOWER_BOUND ||
      offset > API_LIMITS.SHARING.GET.INVITATIONS.OFFSET.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'offset',
        API_LIMITS.SHARING.GET.INVITATIONS.OFFSET.LOWER_BOUND,
        API_LIMITS.SHARING.GET.INVITATIONS.OFFSET.UPPER_BOUND,
      );
    }

    const invites = await this.sharingService.getInvitesByUser(
      user,
      limit,
      offset,
    );

    return { invites };
  }

  @Post('/invites/send')
  createInvite(
    @UserDecorator() user: User,
    @Body() createInviteDto: CreateInviteDto,
  ) {
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
    description: 'Id of the invitation to delete',
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
          `[SHARING/GETSHAREDFILES] Error while getting shared folders by folder ${
            user.uuid
          }, message: ${error.message}, ${error.stack || 'No stack trace'}`,
        );

        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @Post('/')
  createSharing(
    @UserDecorator() user,
    @Body() acceptInviteDto: CreateSharingDto,
  ) {
    return this.sharingService.createSharing(user, acceptInviteDto);
  }

  @Delete('/:itemType/:itemId')
  @ApiParam({
    name: 'itemType',
    description: 'file | folder',
    type: String,
  })
  @ApiParam({
    name: 'itemId',
    description: 'UUID of the item to remove from any sharing',
    type: String,
  })
  @ApiOperation({
    summary: 'Stop sharing an item',
  })
  @ApiOkResponse({ description: 'Item removed from sharing' })
  @ApiBearerAuth()
  removeSharing(
    @UserDecorator() user: User,
    @Param('itemType') itemType: Sharing['itemType'],
    @Param('itemId') itemId: Sharing['itemId'],
  ) {
    return this.sharingService.removeSharing(user, itemId, itemType);
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

  @Put('/:sharingId/role')
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing whose role is going to be updated',
    type: String,
  })
  updateSharingRole(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
    @Body() dto: UpdateSharingRoleDto,
  ) {
    return this.sharingService.updateSharingRole(user, sharingId, dto);
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
        `[SHARING/GETSHAREDFOLDERS] Error while getting shared folders with user ${
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
        `[SHARING/GETSHAREDBYME] Error while getting shared folders by user ${
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

  @Get('/files')
  @ApiOperation({
    summary: 'Get all files shared by/with a user',
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
  @ApiOkResponse({ description: 'Get all files shared by/with a user' })
  @ApiBearerAuth()
  async getAllSharedFiles(
    @UserDecorator() user: User,
    @Query('orderBy') orderBy: OrderBy,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<GetItemsReponse | { error: string }> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.sharingService.getSharedFiles(user, offset, limit, order);
  }

  @Get('shared-with/:itemType/:itemId')
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Get all users that have access to a file or folder',
  })
  @ApiOperation({
    summary: 'Get all users that have access to a file or folder',
  })
  @ApiQuery({
    description: 'Items offset',
    name: 'offset',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items to request',
    name: 'limit',
    required: false,
    type: Number,
  })
  async getItemsSharedsWith(
    @UserDecorator() user: User,
    @Query('limit') limit = 0,
    @Query('offset') offset = 50,
    @Param('itemId') itemId: Sharing['itemId'],
    @Param('itemType') itemType: Sharing['itemType'],
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ users: Array<any> } | { error: string }> {
    try {
      const users = await this.sharingService.getItemSharedWith(
        user,
        itemId,
        itemType,
        offset,
        limit,
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
          `[SHARING/GETSHAREDWITHME] Error while getting shared with by folder id ${
            user.uuid
          }, ${error.stack || 'No stack trace'}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal server error';
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
  ): Promise<{ users: Array<any> } | { error: string }> {
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
          `[SHARING/GETSHAREDWITHME] Error while getting shared with by folder id ${
            user.uuid
          }, ${error.stack || 'No stack trace'}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal server error';
      }
      return { error: errorMessage };
    }
  }

  @Delete('/:itemType/:itemId/users/:userId')
  @ApiParam({
    name: 'userId',
    description: 'UUID of the user to remove from the shared item',
    type: String,
  })
  @ApiParam({
    name: 'itemType',
    description: 'file | folder',
    type: String,
  })
  @ApiParam({
    name: 'itemId',
    description: 'UUID of the item to remove the user from',
    type: String,
  })
  @ApiOperation({
    summary: 'Remove a user from a shared item',
  })
  @ApiOkResponse({ description: 'User removed from shared item' })
  @ApiBearerAuth()
  async removeUserFromSharedItem(
    @Param('userId', ParseUUIDPipe) userUuid: User['uuid'],
    @Param('itemId', ParseUUIDPipe) itemId: Sharing['itemId'],
    @Param('itemType') itemType: Sharing['itemType'],
    @UserDecorator() user: User,
  ): Promise<{ message: string }> {
    await this.sharingService.removeSharedWith(
      itemId,
      itemType,
      userUuid,
      user,
    );

    return { message: 'User removed from shared folder' };
  }
}
