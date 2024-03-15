import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { DisableGlobalAuth } from '../auth/decorators/disable-global-auth.decorator';
import { GatewayGuard } from '../auth/gateway.guard';

@ApiTags('Gateway')
@Controller('gateway')
@DisableGlobalAuth()
export class GatewayController {
  constructor(private gatewayUseCases: GatewayUseCases) {}

  @Post('/workspaces')
  @ApiOperation({
    summary: 'Initiates a workspace',
  })
  @UseGuards(GatewayGuard)
  @ApiOkResponse({ description: 'Returns the workspace created' })
  async initializeWorkspace(
    @Body() initializeWorkspaceDto: InitializeWorkspaceDto,
  ) {
    return this.gatewayUseCases.initializeWorkspace(initializeWorkspaceDto);
  }
}
