import { Module } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { SequelizeSharingRepository } from './sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  PermissionModel,
  RoleModel,
  SharingInviteModel,
  SharingModel,
  SharingRolesModel,
} from './models';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PermissionModel,
      RoleModel,
      SharingRolesModel,
      SharingModel,
      SharingInviteModel,
    ]),
    FileModule,
    FolderModule,
    UserModule,
  ],
  controllers: [SharingController],
  providers: [SharingService, SequelizeSharingRepository],
})
export class SharingModule {}
