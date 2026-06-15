import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../../auth/decorators/user.decorator';
import { User } from '../../user/user.domain';
import { BackupUseCase } from '../backup.usecase';
import { CreateDeviceAsFolderDto } from '../dto/create-device-as-folder.dto';
import { ValidateUUIDPipe } from '../../../common/pipes/validate-uuid.pipe';
import { DeviceAsFolder } from '../dto/responses/device-as-folder.dto';
import { FeatureLimit } from '../../feature-limit/feature-limits.guard';
import { ApplyLimit } from '../../feature-limit/decorators/apply-limit.decorator';
import { LimitLabels } from '../../feature-limit/limits.enum';

@ApiTags('Photos')
@Controller('photos')
@ApplyLimit({ limitLabels: [LimitLabels.PhotosAccess] })
@UseGuards(FeatureLimit)
export class PhotosController {
  constructor(private readonly backupUseCases: BackupUseCase) {}

  @Post('/devices')
  @ApiOperation({ summary: 'Create a photo device as folder' })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async createPhotoDeviceAsFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.createPhotoDeviceAsFolder(user, body.deviceName);
  }

  @Get('/devices')
  @ApiOperation({ summary: 'Get all photo devices as folder' })
  @ApiOkResponse({ type: DeviceAsFolder, isArray: true })
  @ApiBearerAuth()
  async getPhotoDevicesAsFolder(
    @UserDecorator() user: User,
  ): Promise<DeviceAsFolder[]> {
    return this.backupUseCases.getPhotoDevicesAsFolder(user);
  }

  @Get('/devices/:uuid')
  @ApiOperation({ summary: 'Get photo device as folder by uuid' })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async getPhotoDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.getPhotoDeviceAsFolder(user, uuid);
  }

  @Delete('/devices/:uuid')
  @ApiOperation({ summary: 'Delete photo device as folder by uuid' })
  @ApiBearerAuth()
  async deletePhotoDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ) {
    return this.backupUseCases.deletePhotoDeviceAsFolder(user, uuid);
  }

  @Patch('/devices/:uuid')
  @ApiOperation({ summary: 'Update photo device as folder by uuid' })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async updatePhotoDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.updatePhotoDeviceAsFolder(
      user,
      uuid,
      body.deviceName,
    );
  }
}
