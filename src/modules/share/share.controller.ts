import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import getEnv from '../../config/configuration';

@ApiTags('Share')
@Controller('storage/share')
export class ShareController {
  @Get('/domains')
  @Public()
  @ApiOperation({
    summary: 'Get the domains for the sharing links',
    deprecated: true,
  })
  @ApiOkResponse({
    description: 'Get the domains for the sharing links',
  })
  getDomains() {
    return { list: getEnv().apis.share.url.split(',') };
  }
}
