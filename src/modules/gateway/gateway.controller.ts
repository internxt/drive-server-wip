import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { DisableGlobalAuth } from '../auth/decorators/disable-global-auth.decorator';
import { GatewayGuard } from '../auth/gateway.guard';
import { UpdateWorkspaceStorageDto } from './dto/update-workspace-storage.dto';
import { DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { User } from '../user/user.domain';

@ApiTags('Gateway')
@Controller('gateway')
@DisableGlobalAuth()
export class GatewayController {
  constructor(private gatewayUseCases: GatewayUseCases) {}

  @Post('/workspaces')
  @ApiOperation({
    summary: 'Initiates a workspace',
  })
  @ApiBearerAuth('gateway')
  @UseGuards(GatewayGuard)
  @ApiOkResponse({ description: 'Returns the workspace created' })
  async initializeWorkspace(
    @Body() initializeWorkspaceDto: InitializeWorkspaceDto,
  ) {
    return this.gatewayUseCases.initializeWorkspace(initializeWorkspaceDto);
  }

  @Put('/workspaces/storage')
  @ApiOperation({
    summary: 'Update a workspace',
  })
  @ApiBearerAuth('gateway')
  @UseGuards(GatewayGuard)
  @ApiOkResponse({ description: 'Returns the workspace updated' })
  async updateWorkspaceStorage(
    @Body() updateWorkspaceStorageDto: UpdateWorkspaceStorageDto,
  ) {
    return this.gatewayUseCases.updateWorkspaceStorage(
      updateWorkspaceStorageDto.ownerId,
      updateWorkspaceStorageDto.maxSpaceBytes,
    );
  }

  @Delete('/workspaces')
  @ApiOperation({
    summary: 'Destroy a workspace',
  })
  @ApiBearerAuth('gateway')
  @UseGuards(GatewayGuard)
  @ApiOkResponse({ description: 'Delete workspace by owner id' })
  async destroyWorkspace(@Body() deleteWorkspaceDto: DeleteWorkspaceDto) {
    return this.gatewayUseCases.destroyWorkspace(deleteWorkspaceDto.ownerId);
  }

  @Get('/users/:email')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user details by email',
  })
  @ApiParam({ name: 'email', type: String, required: true })
  @ApiOkResponse({
    description: 'Details of the user',
  })
  @UseGuards(GatewayGuard)
  async getUserByEmail(@Param('email') email: User['email']) {
    return this.gatewayUseCases.getUserByEmail(email);
  }
}
