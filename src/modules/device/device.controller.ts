import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getDeviceContextByUserAgent } from '../../lib/device-context';
import { Public } from '../auth/decorators/public.decorator';
@ApiTags('Device')
@Controller('device')
export class DeviceController {
  @Get('/context')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Device Context',
  })
  @ApiOkResponse({ description: 'Get Device Context by user agent' })
  @Public()
  @UseGuards(AuthGuard('basic'))
  async getDevice(@Headers('user-agent') userAgent: string) {
    if (!userAgent) {
      throw new BadRequestException('no user-agent available');
    }
    const context = getDeviceContextByUserAgent(userAgent);
    return context;
  }
}
