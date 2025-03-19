import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { BackupUseCase } from './backup.usecase';
import { CreateDeviceAsFolderDto } from './dto/create-device-as-folder.dto';
import { ValidateUUIDPipe } from '../workspaces/pipes/validate-uuid.pipe';

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
  @ApiBearerAuth()
  async createDeviceAsFolder(
    @UserDecorator() user: User,
    @Body() body: CreateDeviceAsFolderDto,
  ) {
    return this.backupUseCases.createDeviceAsFolder(user, body.deviceName);
  }

  @Get('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Get device as folder by uuid',
  })
  @ApiBearerAuth()
  async getDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
  ) {
    return this.backupUseCases.getDeviceAsFolder(user, uuid);
  }

  @Patch('/deviceAsFolder/:uuid')
  @ApiOperation({
    summary: 'Update device as folder by uuid',
  })
  @ApiBearerAuth()
  async updateDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('uuid', ValidateUUIDPipe) uuid: string,
    @Body() body: CreateDeviceAsFolderDto,
  ) {
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
  @ApiBearerAuth()
  async getDevicesAsFolder(@UserDecorator() user: User) {
    return this.backupUseCases.getDevicesAsFolder(user);
  }
}
