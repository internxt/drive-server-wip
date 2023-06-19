import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Headers,
  Res,
  ForbiddenException,
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
import { File, FileAttributes } from '../file/file.domain';
import { ShareDto } from './dto/share.dto';
import { Folder } from '../folder/folder.domain';
import { ReferralKey, User } from '../user/user.domain';

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

    const decryptedItemNames = shares.items.map((item) => {
      item.item = this.decryptItem(item.item);

      return item;
    });

    return {
      ...shares,
      items: decryptedItemNames,
    };
  }

  @Get('/:token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get share by token',
  })
  @ApiOkResponse({ description: 'Get share' })
  @Public()
  async getShareByToken(
    @Param('token') token: string,
    @Query('code') code: string,
    @Headers('x-share-password') password: string | null,
  ): Promise<ShareDto> {
    const share = await this.shareUseCases.getShareByToken(
      token,
      code,
      password,
    );
    const shareJSON = share.toJSON();
    shareJSON.item = this.decryptItem(share.item);

    return shareJSON;
  }

  @Put(':token/view')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Increment share view by token',
  })
  @ApiOkResponse({ description: 'Increment share view by token' })
  @Public()
  async incrementViewById(
    @UserDecorator() user: User,
    @Param('token') token: string,
    @Req() req: Request,
    @Headers('x-share-password') password: string | null,
  ) {
    user = await this.getUserWhenPublic(user);

    const share = await this.shareUseCases.getShareByToken(
      token,
      null,
      password,
    );
    const incremented = await this.shareUseCases.incrementShareView(
      share,
      user,
    );
    if (incremented) {
      const shareLinkViewEvent = new ShareLinkViewEvent(
        'share.view',
        user,
        share,
        req,
        {},
      );
      this.notificationService.add(shareLinkViewEvent);
    }
    return {
      incremented,
      token,
    };
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
  @ApiOperation({ summary: 'Create share for file' })
  @ApiOkResponse({ description: 'The share of the file' })
  async generateSharedTokenToFile(
    @UserDecorator() user: User,
    @Param('fileId') fileId: FileAttributes['id'],
    @Body() body: CreateShareDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const { id, item, created, encryptedCode } =
      await this.shareUseCases.createShareFile(fileId, user, body);

    if (created) {
      this.userUseCases
        .applyReferral(user.id, ReferralKey.ShareFile)
        .catch((err: Error) => {
          new Logger().error(
            `[REFERRAL/SHARE]: ERROR applying referral to user ${user.uuid}: ${err.message}`,
          );
        });
    }

    const shareLinkViewEvent = new ShareLinkCreatedEvent(
      'share.created',
      user,
      item,
      req,
      {},
    );
    this.notificationService.add(shareLinkViewEvent);

    res.status(created ? HttpStatus.CREATED : HttpStatus.OK).json({
      id,
      created,
      token: item.token,
      encryptedCode,
    });
  }

  @Post('folder/:folderId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create share for folder' })
  @ApiOkResponse({ description: 'The share of the folder' })
  async generateFolderShare(
    @UserDecorator() user: User,
    @Param('folderId') folderId: string,
    @Body() body: CreateShareDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    new Logger().log(
      `[SHARE/CREATE/FOLDER]: user ${user.uuid} payload -> ${JSON.stringify(
        body,
      )}`,
    );

    try {
      const share = await this.shareUseCases.createShareFolder(
        parseInt(folderId),
        user,
        body,
      );

      res.status(share.created ? HttpStatus.CREATED : HttpStatus.OK).json({
        id: share.id,
        created: share.created,
        token: share.item.token,
        encryptedCode: share.encryptedCode,
      });

      const shareLinkViewEvent = new ShareLinkCreatedEvent(
        'share.created',
        user,
        share.item,
        req,
        {},
      );
      this.notificationService.add(shareLinkViewEvent);
    } catch (err) {
      new Logger().error(
        `[SHARE/CREATE/FOLDER] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({ ...body, user })}, STACK: ${
          (err as Error).stack
        }`,
      );
      throw err;
    }
  }

  @Get('down/files')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all files by token paginated',
  })
  @ApiOkResponse({ description: 'Get all files' })
  @Public()
  async getDownFiles(
    @Query() query: GetDownFilesDto,
    @Headers('x-share-password') password: string | null,
  ) {
    try {
      const { token, folderId, code, page, perPage } = query;

      const share = await this.shareUseCases.getShareByToken(
        token,
        null,
        password,
      );

      const isSharedRootFolderRequested = share.folderId === folderId;

      if (!isSharedRootFolderRequested) {
        const isFilesFolderBehindSharedFolder =
          await this.folderUseCases.isFolderInsideFolder(
            share.folderId,
            folderId,
            share.userId,
          );

        if (!isFilesFolderBehindSharedFolder) {
          throw new ForbiddenException();
        }
      }

      const network = await this.userUseCases.getNetworkByUserId(
        share.userId,
        share.mnemonic,
      );
      const files = await this.fileUseCases.getByFolderAndUser(
        folderId,
        share.userId,
        {
          deleted: false,
          page: parseInt(page),
          perPage: parseInt(perPage),
        },
      );

      for (const file of files) {
        const encryptionKey =
          await this.fileUseCases.getEncryptionKeyFileFromShare(
            file.fileId,
            network,
            share,
            code,
          );

        const name = this.shareUseCases.decryptFilenameString(
          file.name,
          file.folderId,
        );
        Object.assign(file, { encryptionKey, name });
      }

      return { files, last: parseInt(perPage) > files.length };
    } catch (err) {
      Logger.error(`Error getting shared files: ${err}. Stack: ${err.stack}`);
      throw err;
    }
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
    @Headers('x-share-password') password: string | null,
  ) {
    try {
      const { token, folderId, page, perPage } = query;
      const share = await this.shareUseCases.getShareByToken(
        token,
        null,
        password,
      );

      const isSharedRootFolderRequested = share.folderId === folderId;

      if (!isSharedRootFolderRequested) {
        const isFoldersParentBehindSharedFolder =
          await this.folderUseCases.isFolderInsideFolder(
            share.folderId,
            folderId,
            share.userId,
          );

        if (!isFoldersParentBehindSharedFolder) {
          throw new ForbiddenException();
        }
      }

      const folders = await this.folderUseCases.getFoldersByParent(
        folderId,
        parseInt(page),
        parseInt(perPage),
      );
      const decryptedFolders = folders.map((folder) =>
        this.decryptItem(folder),
      );
      return {
        folders: decryptedFolders,
        last: parseInt(perPage) > folders.length,
      };
    } catch (err) {
      Logger.error(
        `Error getting shared folders: ${err.message}. Stack: ${err.stack}`,
      );
      throw err;
    }
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }

  private decryptItem(item: File | Folder): File | Folder {
    if (item instanceof File) {
      return this.fileUseCases.decrypFileName(item);
    }

    if (item instanceof Folder) {
      return this.folderUseCases.decryptFolderName(item);
    }

    return item;
  }
}
