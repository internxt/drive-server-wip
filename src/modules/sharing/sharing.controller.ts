import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
  Query,
  Logger,
  ParseUUIDPipe,
  UseGuards,
  NotFoundException,
  Headers,
  Patch,
  HttpException,
  InternalServerErrorException,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SharingService } from './sharing.service';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { CreateInviteDto } from './dto/create-invite.dto';
import {
  Sharing,
  SharingInvite,
  SharingItemType,
  SharingRole,
} from './sharing.domain';
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
import { ChangeSharingType } from './dto/change-sharing-type.dto';
import { SetSharingPasswordDto } from './dto/set-sharing-password.dto';
import { UuidDto } from '../../common/dto/uuid.dto';
import { WorkspaceResourcesAction } from '../workspaces/guards/workspaces-resources-in-behalf.types';
import { WorkspacesInBehalfGuard } from '../workspaces/guards/workspaces-resources-in-behalf.decorator';
import { GetDataFromRequest } from '../../common/extract-data-from-request';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogGlobalActionType } from '../workspaces/attributes/workspace-logs.attributes';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { ItemSharingInfoDto } from './dto/response/get-item-sharing-info.dto';
import getEnv from '../../config/configuration';
import { FileAttributes } from '../file/file.domain';
import {
  GetFilesInSharedFolderResponseDto,
  GetFoldersInSharedFolderResponseDto,
} from './dto/response/get-folders-in-shared-folder.dto';
import { GetItemsInSharedFolderQueryDto } from './dto/get-items-in-shared-folder.dto';
import { CaptchaGuard } from '../auth/captcha.guard';

@ApiTags('Sharing')
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
  @ApiHeader({
    name: 'x-share-password',
    description: 'URI Encoded password to get access to the sharing',
  })
  @ApiOkResponse({ description: 'Get sharing metadata' })
  async getPublicSharing(
    @Param('sharingId', ValidateUUIDPipe) sharingId: Sharing['id'],
    @Query('code') code: string,
    @Headers('x-share-password') password: string | null,
  ) {
    if (!code) {
      throw new BadRequestException('Code is required');
    }
    const decodedPassword = password ? decodeURIComponent(password) : null;
    return this.sharingService.getPublicSharingById(
      sharingId,
      code,
      decodedPassword,
    );
  }

  @Get('/public/:sharingId/item')
  @Public()
  @ApiOperation({
    summary: 'Get sharing item info',
  })
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing',
    type: String,
  })
  @ApiOkResponse({ description: 'Get sharing item info' })
  async getPublicSharingItemInfo(@Param('sharingId') sharingId: Sharing['id']) {
    return this.sharingService.getPublicSharingItemInfo(sharingId);
  }

  @Patch('/:sharingId/password')
  @ApiOperation({
    summary: 'Set password for public sharing',
  })
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing',
    type: String,
  })
  @GetDataFromRequest([{ sourceKey: 'params', fieldName: 'sharingId' }])
  @WorkspacesInBehalfGuard(WorkspaceResourcesAction.ModifySharingById)
  @ApiOkResponse({ description: 'Sets/edit password for public sharings' })
  async setPublicSharingPassword(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
    @Body() sharingPasswordDto: SetSharingPasswordDto,
  ) {
    const { encryptedPassword } = sharingPasswordDto;
    return this.sharingService.setSharingPassword(
      user,
      sharingId,
      encryptedPassword,
    );
  }

  @Delete('/:sharingId/password')
  @ApiOperation({
    summary: 'Remove password from public sharing',
  })
  @ApiParam({
    name: 'sharingId',
    description: 'Id of the sharing',
    type: String,
  })
  @ApiOkResponse({ description: 'Remove ' })
  @GetDataFromRequest([{ sourceKey: 'params', fieldName: 'sharingId' }])
  @WorkspacesInBehalfGuard(WorkspaceResourcesAction.ModifySharingById)
  async removePublicSharingPassword(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
  ) {
    return this.sharingService.removeSharingPassword(user, sharingId);
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

  @Put('/:itemType/:itemId/type')
  changeSharingType(
    @UserDecorator() user: User,
    @Param('itemType') itemType: Sharing['itemType'],
    @Param('itemId') itemId: Sharing['itemId'],
    @Body() dto: ChangeSharingType,
  ) {
    if (itemType !== 'file' && itemType !== 'folder') {
      throw new BadRequestException('Invalid item type');
    }
    return this.sharingService.changeSharingType(
      user,
      itemId,
      itemType,
      dto.sharingType,
    );
  }

  @Get('/:itemType/:itemId/type')
  @ApiOperation({
    deprecated: true,
    description:
      'Get sharing (private or public) type, deprecated in favor of :itemType/:itemId/info',
  })
  getSharingType(
    @UserDecorator() user: User,
    @Param('itemType') itemType: Sharing['itemType'],
    @Param('itemId') itemId: Sharing['itemId'],
  ) {
    if (itemType !== 'file' && itemType !== 'folder') {
      throw new BadRequestException('Invalid item type');
    }
    return this.sharingService.getSharingType(user, itemId, itemType);
  }

  @Get(':itemType/:itemId/info')
  @ApiOperation({
    summary: 'Get info related to item sharing',
  })
  @ApiResponse({ type: ItemSharingInfoDto })
  @ApiNotFoundResponse({
    description: 'Item has no active sharings or invitations',
  })
  getItemSharingStatus(
    @UserDecorator() user: User,
    @Param('itemType') itemType: Sharing['itemType'],
    @Param('itemId') itemId: Sharing['itemId'],
  ) {
    if (itemType !== 'file' && itemType !== 'folder') {
      throw new BadRequestException('Invalid item type');
    }
    return this.sharingService.getItemSharingInfo(user, itemId, itemType);
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

  @UseGuards(CaptchaGuard)
  @Post('/invites/send')
  /*   @ApplyLimit({
    limitLabels: [LimitLabels.MaxSharedItemInvites, LimitLabels.MaxSharedItems],
    dataSources: [
      { sourceKey: 'body', fieldName: 'itemId' },
      { sourceKey: 'body', fieldName: 'itemType' },
    ],
  })
  @UseGuards(FeatureLimit) */
  createInvite(
    @UserDecorator() user: User,
    @Body() createInviteDto: CreateInviteDto,
  ) {
    createInviteDto.sharedWith = createInviteDto.sharedWith.toLowerCase();
    return this.sharingService.createInvite(user, createInviteDto);
  }

  @Get('/invites/:id/validate')
  @Public()
  @ApiParam({
    name: 'id',
    description: 'Id of the invite to validate',
    type: String,
  })
  async validateInvite(@Param('id') id: SharingInvite['id']) {
    try {
      return await this.sharingService.validateInvite(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      Logger.error(
        `[SHARING/VALIDATEINVITE] Error while trying to validate invitation ${id}, message: ${
          error.message
        }, ${error.stack ?? 'No stack trace'}`,
      );

      throw new InternalServerErrorException();
    }
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
    summary: 'Get all files inside a shared folder',
  })
  @ApiParam({
    name: 'sharedFolderId',
    description: 'Folder uuid of the shared folder',
    type: String,
  })
  @ApiOkResponse({
    description: 'Get all folders inside a shared folder',
    type: GetFoldersInSharedFolderResponseDto,
  })
  async getFoldersInPrivateSharedFolder(
    @UserDecorator() user: User,
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Query() query: GetItemsInSharedFolderQueryDto,
  ): Promise<GetFoldersInSharedFolderResponseDto> {
    const { token, page = 0, perPage = 50 } = query;

    return this.sharingService.getFoldersInSharedFolder(
      sharedFolderId,
      token,
      user,
      page,
      perPage,
    );
  }

  @Get('items/:sharedFolderId/files')
  @ApiOperation({
    summary: 'Get all folders inside a shared folder',
  })
  @ApiParam({
    name: 'sharedFolderId',
    description: 'Folder uuid of the shared folder',
    type: String,
  })
  @ApiOkResponse({
    description: 'Get all items inside a shared folder',
    type: GetFilesInSharedFolderResponseDto,
  })
  @ApiBearerAuth()
  async getFilesInPrivateSharedFolder(
    @UserDecorator() user: User,
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Query() query: GetItemsInSharedFolderQueryDto,
  ): Promise<GetFilesInSharedFolderResponseDto> {
    const { token, page = 0, perPage = 50 } = query;

    return this.sharingService.getFilesInSharedFolder(
      sharedFolderId,
      token,
      user,
      page,
      perPage,
    );
  }

  @Get('/public/items/:sharedFolderId/files')
  @Public()
  @ApiOperation({
    summary: 'Get all items shared by a user inside a sharing',
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
  async getPublicShareFiles(
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Query('token') token: string,
    @Query('code') code: string,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ): Promise<GetFilesResponse | { error: string }> {
    return this.sharingService.getFilesFromPublicFolder(
      sharedFolderId,
      token,
      code,
      page,
      perPage,
    );
  }

  @Get('/public/items/:sharedFolderId/folders')
  @Public()
  @ApiOperation({
    summary: 'Get all items shared by a user inside a sharing',
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
  async getPublicSharedFolders(
    @Param('sharedFolderId') sharedFolderId: Folder['uuid'],
    @Query('token') token: string,
    @Query('code') code: string,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
  ) {
    return this.sharingService.getFoldersFromPublicFolder(
      sharedFolderId,
      token,
      page,
      perPage,
    );
  }

  @Post('/')
  /*   @ApplyLimit({
    limitLabels: [LimitLabels.MaxSharedItems],
    dataSources: [{ sourceKey: 'body', fieldName: 'itemId' }],
  })
  @UseGuards(FeatureLimit) */
  @GetDataFromRequest([
    { sourceKey: 'body', fieldName: 'itemId' },
    { sourceKey: 'body', fieldName: 'itemType' },
  ])
  @WorkspacesInBehalfGuard()
  @WorkspaceLogAction(WorkspaceLogGlobalActionType.Share)
  createSharing(
    @UserDecorator() user,
    @Body() acceptInviteDto: CreateSharingDto,
  ) {
    return this.sharingService.createPublicSharing(user, acceptInviteDto);
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
  @GetDataFromRequest([
    { sourceKey: 'params', fieldName: 'itemId' },
    { sourceKey: 'params', fieldName: 'itemType' },
  ])
  @WorkspacesInBehalfGuard()
  removeSharing(
    @UserDecorator() user: User,
    @Param('itemType', new ParseEnumPipe(SharingItemType))
    itemType: Sharing['itemType'],
    @Param('itemId', ParseUUIDPipe) itemId: Sharing['itemId'],
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
        }, ${err.stack ?? 'No stack trace'}`,
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
        }, ${err.stack ?? 'No stack trace'}`,
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
      ? [orderBy.split(':') as [keyof FileAttributes, 'ASC' | 'DESC']]
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
    @Param('itemId') itemId: Sharing['itemId'],
    @Param('itemType') itemType: Sharing['itemType'],
  ): Promise<{ users: Array<any> }> {
    try {
      const users = await this.sharingService.getItemSharedWith(
        user,
        itemId,
        itemType,
      );

      return { users };
    } catch (error) {
      Logger.error(
        `[SHARING/GETSHAREDWITHME] Error while getting shared with by folder id ${
          user.uuid
        }, ${error.stack ?? 'No stack trace'}`,
      );
      throw error;
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
      if (error instanceof HttpException) {
        throw error;
      }
      Logger.error(
        `[SHARING/GETSHAREDWITHME] Error while getting shared with by folder id ${
          user.uuid
        }, ${error.stack ?? 'No stack trace'}`,
      );
      throw new InternalServerErrorException();
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

  @Public()
  @Get('public/:id/folder/size')
  async getPublicSharingFolderSize(@Param() param: UuidDto) {
    const size = await this.sharingService.getPublicSharingFolderSize(param.id);

    return { size };
  }

  @Get('public/domains')
  @Public()
  async getPublicSharingDomains() {
    return { list: getEnv().apis.share.url.split(',') };
  }
}
