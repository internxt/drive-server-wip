import { Controller, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatewayUseCases } from './gateway.usecase';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Gateway')
@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayUseCases: GatewayUseCases) {}

  @Get('/users/:uuid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get user credentials' })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
  })
  @UseGuards(AuthGuard)
  getUserCredentials(@Param('uuid') uuid: string) {
    return this.gatewayUseCases.getUserCredentials(uuid);
  }
}
