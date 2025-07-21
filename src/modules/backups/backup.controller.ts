import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { BackupUseCase } from './backup.usecase';
import { CreateDeviceAsFolderDto } from './dto/create-device-as-folder.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { DeviceAsFolder } from './dto/responses/device-as-folder.dto';
import { GetDevicesAndFoldersDto } from './dto/get-devices-and-folders.dto';
import { CreateDeviceAndFolderDto } from './dto/create-device-and-folder.dto';
import { CreateDeviceAndAttachFolderDto } from './dto/create-device-and-attach-folder.dto';
import { DeviceDto } from './dto/responses/device.dto';
import { UpdateDeviceAndFolderDto } from './dto/update-device-and-folder.dto';

@ApiTags('Backup')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupUseCases: BackupUseCase) {}

  @Post('/activate')
  @ApiOperation({
    summary: 'Activate user backup',
  })
  @ApiBearerAuth()
  async activateBackup(@UserDecorator() user: User) {
    return this.backupUseCases.activate(user);
  }

  @Get('/v2/devices')
  @ApiOperation({
    summary: 'List user backup devices',
    description:
      'Retrieve all backup devices associated with the current user, along with their linked backup folders.',
  })
  @ApiOkResponse({
    type: DeviceDto,
    isArray: true,
    description: 'List of devices.',
  })
  @ApiBearerAuth()
  async getDevicesAndFolders(
    @UserDecorator() user: User,
    @Query() query: GetDevicesAndFoldersDto,
  ) {
    const { platform, key, hostname } = query;

    const filterBy = {
      ...(platform && { platform }),
      ...(key && { key }),
      ...(hostname && { hostname }),
    };

    return this.backupUseCases.getUserDevices(
      user,
      filterBy,
      query.limit,
      query.offset,
    );
  }

  @Post('/v2/devices')
  @ApiOperation({
    summary: 'Create new device with backup folder',
    description:
      'Register a new backup device and create a new backup folder for it.',
  })
  @ApiCreatedResponse({
    type: DeviceDto,
    description: 'The newly created device',
  })
  @ApiBearerAuth()
  async createDeviceAndFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAndFolderDto,
  ) {
    return this.backupUseCases.createDeviceAndFolder(user, body);
  }

  @Post('/v2/devices/migrate')
  @ApiOperation({
    summary: 'Register device for existing backup folder',
    description:
      'Register a new device and link it to an existing backup folder. Primarily used for migrating existing backup folders to the new device-folder model.',
  })
  @ApiOkResponse({
    type: DeviceDto,
    description: 'The created device',
  })
  @ApiBearerAuth()
  async createDeviceForExistingFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAndAttachFolderDto,
  ) {
    return this.backupUseCases.createDeviceForExistingFolder(user, body);
  }

  @Delete('/v2/devices/:deviceId')
  @ApiOperation({
    summary: 'Delete device and its linked folder by ID',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Successfully deleted the device and its linked folder.',
  })
  async deleteDeviceAndFolder(
    @UserDecorator() user: User,
    @Param('deviceId', ParseIntPipe) deviceId: number,
  ) {
    return this.backupUseCases.deleteDeviceAndFolder(user, deviceId);
  }

  @Patch('/v2/devices/:deviceId')
  @ApiOperation({
    summary: 'Update device',
  })
  @ApiOkResponse({
    type: DeviceDto,
    description: 'The updated device',
  })
  @ApiBearerAuth()
  async updateDevice(
    @UserDecorator() user: User,
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() body: UpdateDeviceAndFolderDto,
  ) {
    return this.backupUseCases.updateDeviceAndFolderName(user, deviceId, body);
  }

  @Post('/deviceAsFolder')
  @ApiOperation({
    summary: 'Create a folder using device name',
  })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async createDeviceAsFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.createDeviceAsFolder(user, body.deviceName);
  }

  @Delete('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Delete device as folder by uuid',
  })
  @ApiBearerAuth()
  async deleteDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ) {
    return this.backupUseCases.deleteDeviceAsFolder(user, uuid);
  }

  @Get('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Get device as folder by uuid',
  })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async getDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.getDeviceAsFolder(user, uuid);
  }

  @Get('/deviceAsFolderById/:id')
  @ApiOperation({
    summary: 'Get device as folder by id (deprecated in favor of uuid)',
    deprecated: true,
  })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async getDeviceAsFolderById(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.getDeviceAsFolderById(user, id);
  }

  @Patch('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Update device as folder by uuid',
  })
  @ApiOkResponse({ type: DeviceAsFolder })
  @ApiBearerAuth()
  async updateDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceAsFolder> {
    return this.backupUseCases.updateDeviceAsFolder(
      user,
      uuid,
      body.deviceName,
    );
  }

  @Get('/deviceAsFolder')
  @ApiOperation({
    summary: 'Get all devices as folder',
  })
  @ApiOkResponse({ type: DeviceAsFolder, isArray: true })
  @ApiBearerAuth()
  async getDevicesAsFolder(
    @UserDecorator() user: User,
  ): Promise<DeviceAsFolder[]> {
    return this.backupUseCases.getDevicesAsFolder(user);
  }

  @Get('/devices')
  @ApiOperation({
    summary:
      'Get all user devices. Will not retrieve any device linked to a folder',
    deprecated: true,
  })
  @ApiBearerAuth()
  async getAllDevices(@UserDecorator() user: User) {
    return this.backupUseCases.getAllLegacyDevices(user);
  }

  @Delete('/devices/:deviceId')
  @ApiOperation({
    summary: 'Delete user device',
    deprecated: true,
  })
  @ApiBearerAuth()
  async deleteDevice(
    @UserDecorator() user: User,
    @Param('deviceId') deviceId: number,
  ) {
    return this.backupUseCases.deleteDevice(user, deviceId);
  }

  @Get('/:mac')
  @ApiOperation({
    summary: 'Get backups by mac',
    deprecated: true,
  })
  @ApiBearerAuth()
  async getBackupsByMac(
    @UserDecorator() user: User,
    @Param('mac') mac: string,
  ) {
    return this.backupUseCases.getBackupsByMac(user, mac);
  }

  @Delete('/:backupId')
  @ApiOperation({
    summary: 'Delete backup',
  })
  @ApiBearerAuth()
  async deleteBackup(
    @UserDecorator() user: User,
    @Param('backupId') backupId: number,
  ) {
    return this.backupUseCases.deleteBackup(user, backupId);
  }
}
