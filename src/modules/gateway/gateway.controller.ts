import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { DisableGlobalAuth } from '../auth/decorators/disable-global-auth.decorator';
import { GatewayGuard } from '../auth/gateway.guard';
import { UpdateWorkspaceStorageDto } from './dto/update-workspace-storage.dto';
import { DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { User } from '../user/user.domain';
import { CheckStorageExpansionDto } from './dto/check-storage-expansion.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { UpdateUserDto } from './dto/update-user.dto';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';

@ApiTags('Gateway')
@Controller('gateway')
@DisableGlobalAuth()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    private readonly gatewayUseCases: GatewayUseCases,
    private readonly storageNotificationsService: StorageNotificationService,
  ) {}

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
      updateWorkspaceStorageDto.numberOfSeats,
    );
  }

  @Post('/workspaces/:workspaceId/storage/upgrade-check')
  @ApiOperation({
    summary: 'Precheck for updating a workspace',
  })
  @ApiBearerAuth('gateway')
  @UseGuards(GatewayGuard)
  @ApiOkResponse({ description: 'Returns whether the update is possible' })
  async validateStorageForPlanChange(
    @Body() updateWorkspaceStorageDto: UpdateWorkspaceStorageDto,
  ) {
    return this.gatewayUseCases.validateStorageForPlanChange(
      updateWorkspaceStorageDto.ownerId,
      updateWorkspaceStorageDto.maxSpaceBytes,
      updateWorkspaceStorageDto.numberOfSeats,
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

  @Get('/users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user details',
  })
  @ApiQuery({ name: 'email', type: String, required: true })
  @ApiOkResponse({
    description: 'Details of the user',
  })
  @UseGuards(GatewayGuard)
  async getUserByEmail(@Query('email') email: User['email']) {
    return this.gatewayUseCases.getUserByEmail(email);
  }

  @Get('/users/storage/stackability')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if user can expand storage space',
  })
  @ApiQuery({ name: 'userUuid', type: String, required: true })
  @ApiQuery({ name: 'additionalBytes', type: Number, required: true })
  @UseGuards(GatewayGuard)
  async checkUserStorageExpansion(@Query() queryDto: CheckStorageExpansionDto) {
    const { userUuid, additionalBytes } = queryDto;

    return this.gatewayUseCases.checkUserStorageExpansion(
      userUuid,
      additionalBytes,
    );
  }

  @Patch('/users/:uuid')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user plan and storage',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    required: true,
    description: 'User UUID',
  })
  @UseGuards(GatewayGuard)
  async updateUser(
    @Param('uuid', ValidateUUIDPipe) userUuid: string,
    @Body() body: UpdateUserDto,
  ) {
    this.logger.log(
      { body, userUuid, category: 'UPDATE_USER' },
      'Updating user',
    );

    const { maxSpaceBytes, tierId } = body;

    try {
      const user = await this.gatewayUseCases.getUserByUuid(userUuid);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.gatewayUseCases.updateUser(user, {
        newStorageSpaceBytes: maxSpaceBytes,
        newTierId: tierId,
      });

      this.storageNotificationsService.planUpdated({
        payload: { maxSpaceBytes },
        user,
        clientId: 'gateway',
      });

      this.logger.log(
        { body, userUuid, category: 'UPDATE_USER' },
        'Updated user successfully',
      );
    } catch (error) {
      this.logger.error(
        {
          body,
          userUuid,
          error,
          category: 'UPDATE_USER',
        },
        'Error updating user',
      );
      throw error;
    }
  }
}
