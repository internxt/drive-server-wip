import {
  Controller,
  HttpCode,
  Get,
  Put,
  Param,
  Query,
  Post,
  Body,
  Res,
  HttpStatus,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { ShareUseCases } from './share.usecase';
import { User } from '../auth/decorators/user.decorator';
import { CreateShareDto } from './dto/create-share.dto';
import { Request, Response } from 'express';
import { GetDownFilesDto } from './dto/get-down-files.dto';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { Public } from '../auth/decorators/public.decorator';
import { UpdateShareDto } from './dto/update-share.dto';
import { NotificationService } from 'src/externals/notifications/notification.service';
import { ShareLinkViewEvent } from 'src/externals/notifications/events/share-link-view.event';
import { RequestContext } from 'src/lib/request-context';

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
    @User() user: any,
    @Query('page') page: string,
    @Query('perPage') perPage: string,
  ) {
    const shares = await this.shareUseCases.listByUserPaginated(
      user,
      parseInt(page) || 1,
      parseInt(perPage) || 50,
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
    @User() user: any,
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    if (user && !user.id && user.email) {
      user = await this.userUseCases.getUserByUsername(user.email);
    }
    const share = await this.shareUseCases.getShareByToken(token, user);

    if ((user && !share.isOwner(user.id)) || !user) {
      const context = new RequestContext(req);
      const shareLinkViewEvent = new ShareLinkViewEvent(
        'share.view',
        user,
        share,
        await context.getContext(),
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
    @User() user: any,
    @Param('shareId') shareId: string,
    @Body() content: UpdateShareDto,
  ) {
    if (!user.id && user.email) {
      user = await this.userUseCases.getUserByUsername(user.email);
    }
    const share = await this.shareUseCases.updateShareById(
      parseInt(shareId),
      user,
      content,
    );
    // notify no analytics if not folder
    return share;
  }

  @Post('file/:fileId')
  @ApiOperation({
    summary: 'Generate Shared Token by file Id',
  })
  @ApiOkResponse({ description: 'Get Token of share' })
  async generateSharedTokenToFile(
    @User() user: any,
    @Param('fileId') fileId: string,
    @Body() body: CreateShareDto,
    @Res() res: Response,
  ) {
    const share = await this.shareUseCases.createShareFile(fileId, user, body);

    res.status(share.created ? HttpStatus.CREATED : HttpStatus.OK).json({
      created: share.created,
      token: share.item.token,
    });
  }

  @Post('folder/:folderId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate Shared Token by folder Id',
  })
  @ApiOkResponse({ description: 'Get token of share' })
  async generateSharedTokenToFolder(
    @User() user: any,
    @Param('folderId') folderId: string,
    @Body() body: CreateShareDto,
    @Res() res: Response,
  ) {
    const share = await this.shareUseCases.createShareFolder(
      parseInt(folderId),
      user,
      body,
    );

    res.status(share.created ? HttpStatus.CREATED : HttpStatus.OK).json({
      created: share.created,
      token: share.item.token,
    });
  }

  @Get('down/files')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all files by token paginated',
  })
  @ApiOkResponse({ description: 'Get all files' })
  @Public()
  async getDownFiles(@User() user: any, @Query() query: GetDownFilesDto) {
    const { token, folderId, code, page, perPage } = query;
    if (!user.id && user.email) {
      user = await this.userUseCases.getUserByUsername(user.email);
    }
    const share = await this.shareUseCases.getShareByToken(token, user);
    share.decryptMnemonic(code);
    const network = await this.userUseCases.getNetworkByUserId(
      user.id,
      share.mnemonic,
    );
    const files = await this.fileUseCases.getByFolderAndUser(
      folderId,
      user,
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
  async getDownFolders(@User() user: any, @Query() query: GetDownFilesDto) {
    const { token, folderId, page, perPage } = query;
    if (!user.id && user.email) {
      user = await this.userUseCases.getUserByUsername(user.email);
    }
    await this.shareUseCases.getShareByToken(token, user);
    const folders = await this.folderUseCases.getFoldersByParent(
      folderId,
      page,
      perPage,
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
    const share = this.shareUseCases.getShareById(shareId);
    if (!share) {
      throw new NotFoundException(`share with id ${shareId} not found`);
    }

    const size = await this.folderUseCases.getFolderSize(folderId);
    return {
      size,
    };
  }
}
