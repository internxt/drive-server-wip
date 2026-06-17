import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getDeviceContextByUserAgent } from '../../lib/device-context';
import { Public } from '../auth/decorators/public.decorator';
@ApiTags('Device')
@Controller('device')
export class DeviceController {
  @Post('/context')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Device Context',
  })
  @ApiOkResponse({ description: 'Get Device Context by user agent' })
  @Public()
  @UseGuards(AuthGuard('basic'))
  async getDevice(@Headers('user-agent') userAgent: string, @Body() body) {
    if (!body.userAgent && !userAgent) {
      throw new BadRequestException('no user-agent available');
    }
    const context = getDeviceContextByUserAgent(body.userAgent || userAgent);
    return context;
  }
}
