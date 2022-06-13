import {
  Controller,
  HttpCode,
  UseGuards,
  Get,
  Param,
  Query,
  Post,
  Body,
  Res,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShareUseCases } from './share.usecase';
import { User } from '../auth/decorators/user.decorator';
import { CreateShareDto } from './dto/create-share.dto';
import { Response } from 'express';
import { GetDownFilesDto } from './dto/get-down-files.dto';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';

@ApiTags('Share')
@Controller('storage/share')
@UseGuards(AuthGuard('jwt'))
export class ShareController {
  constructor(
    private shareUseCases: ShareUseCases,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
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
    summary: 'Get share list',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async getShareByToken(@User() user: any, @Param('token') token: string) {
    const share = await this.shareUseCases.getShareByToken(token, user);
    // notify no analytics if not folder
    return share;
  }

  @Post('file/:fileId')
  @ApiOperation({
    summary: 'Generate Shared Token by file Id',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
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
  @ApiOkResponse({ description: 'Get all shares in a list' })
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
    summary: 'Generate Shared Token by folder Id',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async getDownFiles(@User() user: any, @Query() query: GetDownFilesDto) {
    const { token, folderId, code, page, perPage } = query;
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
    summary: 'Generate Shared Token by folder Id',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async getDownFolders(@User() user: any, @Query() query: GetDownFilesDto) {
    const { token, folderId, page, perPage } = query;
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
    summary: 'Generate Shared Token by folder Id',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async getShareFolderSize(
    @Query('shareId') shareId: number,
    @Query('folderId') folderId: number,
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
