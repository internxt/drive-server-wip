import {
  Controller,
  HttpCode,
  UseGuards,
  Get,
  Param,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShareUseCases } from './share.usecase';
import { User } from '../auth/decorators/user.decorator';
import { CreateShareDto } from './dto/create-share.dto';

@ApiTags('Share')
@Controller('storage/share')
@UseGuards(AuthGuard('jwt'))
export class ShareController {
  constructor(private shareUseCases: ShareUseCases) {}

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
    console.log(page, perPage);
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

  @Post('/file/:fileId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate Shared Token by file Id',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async generateSharedTokenToItem(
    @User() user: any,
    @Param('fileId') fileId: string,
    @Body() body: CreateShareDto,
  ) {
    const share = await this.shareUseCases.createShareFile(fileId, user, body);

    return share;
  }
}
