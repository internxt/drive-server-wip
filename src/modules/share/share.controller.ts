import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShareUseCases } from './share.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { CreateShareDto } from './dto/create-share.dto';
import { Request, Response } from 'express';
import { GetDownFilesDto } from './dto/get-down-files.dto';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { Public } from '../auth/decorators/public.decorator';
import { UpdateShareDto } from './dto/update-share.dto';
import { NotificationService } from '../../externals/notifications/notification.service';
import { ShareLinkViewEvent } from '../../externals/notifications/events/share-link-view.event';
import { ShareLinkCreatedEvent } from '../../externals/notifications/events/share-link-created.event';
import { User } from '../user/user.domain';

@ApiTags('Share')
@Controller('storage/share')
export class ShareController {
  constructor(
    private shareUseCases: ShareUseCases,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
    private notificationService: NotificationService,
  ) {}

  @Get('/list')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get share list',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async listShares(
    @UserDecorator() user: User,
    @Query('page') page: string,
    @Query('perPage') perPage: string,
    @Query('orderBy') orderBy: string,
  ) {
    const possibleOrderByValues = [
      'views:ASC',
      'views:DESC',
      'createdAt:ASC',
      'createdAt:DESC',
    ];

    if (orderBy !== undefined && !possibleOrderByValues.includes(orderBy)) {
      throw new BadRequestException(
        `${orderBy} is not valid as a sortBy param`,
      );
    }
    const shares = await this.shareUseCases.listByUserPaginated(
      user,
      parseInt(page) || 0,
      parseInt(perPage) || 50,
      orderBy as
        | 'views:ASC'
        | 'views:DESC'
        | 'createdAt:ASC'
        | 'createdAt:DESC',
    );
    return shares;
  }

  @Get('/:token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get share by token',
  })
  @ApiOkResponse({ description: 'Get share' })
  @Public()
  async getShareByToken(
    @UserDecorator() user: User,
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    user = await this.getUserWhenPublic(user);
    const share = await this.shareUseCases.getShareByToken(token, user);
    const isTheOwner = user && share.isOwner(user.id);
    if (!isTheOwner) {
      const shareLinkViewEvent = new ShareLinkViewEvent(
        'share.view',
        user,
        share,
        req,
        {},
      );
      this.notificationService.add(shareLinkViewEvent);
    }
    return share.toJSON();
  }

  @Put('/:shareId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update share by id',
  })
  @ApiOkResponse({ description: 'Get share updated' })
  @Public()
  async updateShareByToken(
    @UserDecorator() user: User,
    @Param('shareId') shareId: string,
    @Body() content: UpdateShareDto,
  ) {
    user = await this.getUserWhenPublic(user);
    const share = await this.shareUseCases.updateShareById(
      parseInt(shareId),
      user,
      content,
    );
    return share;
  }

  @Delete('/:shareId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete share by id',
  })
  @ApiOkResponse({ description: 'Delete share by id' })
  @Public()
  async deleteShareByToken(
    @UserDecorator() user: User,
    @Param('shareId') shareId: string,
  ) {
    user = await this.getUserWhenPublic(user);
    const deleted = await this.shareUseCases.deleteShareById(
      parseInt(shareId),
      user,
    );
    return {
      deleted,
      shareId,
    };
  }

  @Post('file/:fileId')
  @ApiOperation({
    summary: 'Generate Shared Token by file Id',
  })
  @ApiOkResponse({ description: 'Get Token of share' })
  async generateSharedTokenToFile(
    @UserDecorator() user: User,
    @Param('fileId') fileId: string,
    @Body() body: CreateShareDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const { item, created } = await this.shareUseCases.createShareFile(
      fileId,
      user,
      body,
    );

    const shareLinkViewEvent = new ShareLinkCreatedEvent(
      'share.created',
      user,
      item,
      req,
      {},
    );
    this.notificationService.add(shareLinkViewEvent);

    res.status(created ? HttpStatus.CREATED : HttpStatus.OK).json({
      created,
      token: item.token,
    });
  }

  @Post('folder/:folderId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate Shared Token by folder Id',
  })
  @ApiOkResponse({ description: 'Get token of share' })
  async generateSharedTokenForFolder(
    @UserDecorator() user: User,
    @Param('folderId') folderId: string,
    @Body() body: CreateShareDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const { item, created } = await this.shareUseCases.createShareFolder(
      parseInt(folderId),
      user,
      body,
    );

    const shareLinkViewEvent = new ShareLinkCreatedEvent(
      'share.created',
      user,
      item,
      req,
      {},
    );
    this.notificationService.add(shareLinkViewEvent);

    res.status(created ? HttpStatus.CREATED : HttpStatus.OK).json({
      created,
      token: item.token,
    });
  }

  @Get('down/files')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all files by token paginated',
  })
  @ApiOkResponse({ description: 'Get all files' })
  @Public()
  async getDownFiles(
    @UserDecorator() user: User,
    @Query() query: GetDownFilesDto,
  ) {
    const { token, folderId, code, page, perPage } = query;
    user = await this.getUserWhenPublic(user);
    const share = await this.shareUseCases.getShareByToken(token, user);
    share.decryptMnemonic(code);
    const network = await this.userUseCases.getNetworkByUserId(
      share.user.id,
      share.mnemonic,
    );
    const files = await this.fileUseCases.getByFolderAndUser(
      folderId,
      share.user.id,
      false,
      parseInt(page),
      parseInt(perPage),
    );

    for (const file of files) {
      file.encryptionKey =
        await this.fileUseCases.getEncryptionKeyFileFromShare(
          file.fileId,
          network,
          share,
          code,
        );
    }

    return { files, last: parseInt(perPage) > files.length };
  }

  @Get('down/folders')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all folders by token paginated',
  })
  @ApiOkResponse({ description: 'Get all folders' })
  @Public()
  async getDownFolders(
    @UserDecorator() user: User,
    @Query() query: GetDownFilesDto,
  ) {
    const { token, folderId, page, perPage } = query;
    user = await this.getUserWhenPublic(user);
    await this.shareUseCases.getShareByToken(token, user);
    const folders = await this.folderUseCases.getFoldersByParent(
      folderId,
      parseInt(page),
      parseInt(perPage),
    );
    return { folders, last: parseInt(perPage) > folders.length };
  }

  @Get(':shareId/folder/:folderId/size')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get size of folder by folderId',
  })
  @ApiOkResponse({ description: 'Get size of folder' })
  @Public()
  async getShareFolderSize(
    @Param('shareId') shareId: number,
    @Param('folderId') folderId: number,
  ) {
    const share = await this.shareUseCases.getShareById(shareId);
    if (!share) {
      throw new NotFoundException(`share with id ${shareId} not found`);
    }

    const size = await this.folderUseCases.getFolderSize(folderId);
    return {
      size,
    };
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }
}
