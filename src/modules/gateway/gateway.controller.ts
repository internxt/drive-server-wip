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
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { User } from '../user/user.domain';
import { CheckStorageExpansionDto } from './dto/check-storage-expansion.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { UpdateUserDto } from './dto/update-user.dto';
import { FailedPaymentDto } from './dto/failed-payment.dto';
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

  @Patch('/workspaces')
  @ApiOperation({
    summary: 'Update workspace tier or storage',
  })
  @ApiBearerAuth('gateway')
  @ApiOkResponse({ description: 'Workspace updated successfully' })
  @UseGuards(GatewayGuard)
  async updateWorkspace(@Body() updateWorkspaceDto: UpdateWorkspaceDto) {
    this.logger.log(
      { body: updateWorkspaceDto, category: 'UPDATE_WORKSPACE' },
      'Updating workspace',
    );

    const { ownerId, tierId, maxSpaceBytes, numberOfSeats } =
      updateWorkspaceDto;

    try {
      await this.gatewayUseCases.updateWorkspace(ownerId, {
        tierId,
        maxSpaceBytes,
        numberOfSeats,
      });

      this.logger.log(
        { body: updateWorkspaceDto, category: 'UPDATE_WORKSPACE' },
        'Updated workspace successfully',
      );
    } catch (error) {
      this.logger.error(
        {
          body: updateWorkspaceDto,
          error,
          category: 'UPDATE_WORKSPACE',
        },
        'Error updating workspace',
      );
      throw error;
    }
  }

  @Put('/workspaces/storage')
  @ApiOperation({
    summary: 'Update a workspace (deprecated in favor of PATCH /workspaces)',
    deprecated: true,
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

  @Post('/users/failed-payment')
  @ApiOperation({
    summary: 'Handle failed payment notification',
    description: 'Sends email notification to user when payment fails',
  })
  @ApiBearerAuth('gateway')
  @UseGuards(GatewayGuard)
  @ApiOkResponse({
    description: 'Failed payment email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  async handleFailedPayment(@Body() dto: FailedPaymentDto) {
    return this.gatewayUseCases.handleFailedPayment(dto.userId);
  }
}
