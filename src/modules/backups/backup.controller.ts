import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { BackupUseCase } from './backup.usecase';
import { CreateDeviceAsFolderDto } from './dto/create-device-as-folder.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { DeviceDto } from './dto/responses/device.dto';

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

  @Post('/deviceAsFolder')
  @ApiOperation({
    summary: 'Create a folder using device name',
  })
  @ApiOkResponse({ type: DeviceDto })
  @ApiBearerAuth()
  async createDeviceAsFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceDto> {
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
  @ApiOkResponse({ type: DeviceDto })
  @ApiBearerAuth()
  async getDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ): Promise<DeviceDto> {
    return this.backupUseCases.getDeviceAsFolder(user, uuid);
  }

  @Get('/deviceAsFolderById/:id')
  @ApiOperation({
    summary: 'Get device as folder by id (deprecated in favor of uuid)',
    deprecated: true,
  })
  @ApiOkResponse({ type: DeviceDto })
  @ApiBearerAuth()
  async getDeviceAsFolderById(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeviceDto> {
    return this.backupUseCases.getDeviceAsFolderById(user, id);
  }

  @Patch('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Update device as folder by uuid',
  })
  @ApiOkResponse({ type: DeviceDto })
  @ApiBearerAuth()
  async updateDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Body() body: CreateDeviceAsFolderDto,
  ): Promise<DeviceDto> {
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
  @ApiOkResponse({ type: DeviceDto, isArray: true })
  @ApiBearerAuth()
  async getDevicesAsFolder(@UserDecorator() user: User): Promise<DeviceDto[]> {
    return this.backupUseCases.getDevicesAsFolder(user);
  }

  @Get('/devices')
  @ApiOperation({
    summary: 'Get all user devices',
  })
  @ApiBearerAuth()
  async getAllDevices(@UserDecorator() user: User) {
    return this.backupUseCases.getAllDevices(user);
  }

  @Delete('/devices/:deviceId')
  @ApiOperation({
    summary: 'Delete user device',
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
