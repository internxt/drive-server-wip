import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { BackupUseCase } from './backup.usecase';
import { CreateDeviceAsFolderDto } from './dto/create-device-as-folder.dto';

@ApiTags('Backup')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupUseCases: BackupUseCase) {}

  @Post('/activate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Activate user backup',
  })
  @ApiBearerAuth()
  async activateBackup(@UserDecorator() user: User) {
    return this.backupUseCases.activate(user);
  }

  @Post('/deviceAsFolder')
  @HttpCode(200)
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

  @Get('/deviceAsFolder/:folderId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get folder by id',
  })
  @ApiBearerAuth()
  async getDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('folderId') folderId: number,
  ) {
    return this.backupUseCases.getDeviceAsFolder(user, folderId);
  }

  @Patch('/deviceAsFolder/:folderId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update device as folder',
  })
  @ApiBearerAuth()
  async updateDeviceAsFolder(
    @UserDecorator() user: User,
    @Param('folderId') folderId: number,
    @Body() body: CreateDeviceAsFolderDto,
  ) {
    return this.backupUseCases.updateDeviceAsFolder(
      user,
      folderId,
      body.deviceName,
    );
  }

  @Get('/deviceAsFolder')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all devices as folder',
  })
  @ApiBearerAuth()
  async getDevicesAsFolder(@UserDecorator() user: User) {
    return this.backupUseCases.getDevicesAsFolder(user);
  }
}
