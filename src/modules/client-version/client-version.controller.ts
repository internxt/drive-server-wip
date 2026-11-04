import { BadRequestException, Controller, Get, Header } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { getAsyncLocalStorage } from '../../common/async-local-storage/async-local-storage';
import { Public } from '../auth/decorators/public.decorator';
import { ClientVersionUseCase } from './client-version.usecase';
import { SkipClientVersionCheck } from './decorators/skip-client-version-check.decorator';
import { ClientCompatibilityResponseDto } from './dto/client-compatibility-response.dto';

@ApiTags('Clients')
@Controller('clients')
export class ClientVersionController {
  constructor(private readonly clientVersionUseCase: ClientVersionUseCase) {}

  @Get('/compatibility')
  @Public()
  @SkipClientVersionCheck()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the compatibility status of the requesting client version',
  })
  @ApiHeader({ name: 'internxt-client', required: true })
  @ApiHeader({ name: 'internxt-version', required: true })
  @ApiOkResponse({ type: ClientCompatibilityResponseDto })
  getCompatibility(): ClientCompatibilityResponseDto {
    const { client, version } = getAsyncLocalStorage() ?? {};
    if (!client || !version) {
      throw new BadRequestException('Unknown client or invalid version');
    }

    return this.clientVersionUseCase.getCompatibility(client, version);
  }
}
