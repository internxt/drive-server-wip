import { Module, forwardRef } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { SequelizeSharingRepository } from './sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  PermissionModel,
  RoleModel,
  SharingInviteModel,
  SharingModel,
} from './models';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import { SharingRolesModel } from './models/sharing-roles.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PermissionModel,
      RoleModel,
      SharingRolesModel,
      SharingModel,
      SharingInviteModel,
    ]),
    forwardRef(() => FileModule),
    FolderModule,
    UserModule,
  ],
  controllers: [SharingController],
  providers: [SharingService, SequelizeSharingRepository],
})
export class SharingModule {}
