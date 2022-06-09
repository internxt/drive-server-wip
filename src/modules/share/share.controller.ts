import { Controller, HttpCode, UseGuards, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShareService } from './share.service';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('Share')
@Controller('share')
@UseGuards(AuthGuard('jwt'))
export class ShareController {
  constructor(private shareService: ShareService) {}

  @Get('/list')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get share list',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async listShares(@User() user: any) {
    const shares = await this.shareService.listByUser(user);
    return shares;
  }
}
