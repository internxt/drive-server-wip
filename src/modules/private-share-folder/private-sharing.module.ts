import { Module } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { UserModule } from '../user/user.module';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { FileModule } from '../file/file.module';
import { FolderModel } from '../folder/folder.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderModel,
      PrivateSharingFolderRolesModel,
      PrivateSharingRoleModel,
      FolderModel,
    ]),
    UserModule,
    FolderModule,
    FileModule,
  ],
  controllers: [PrivateSharingController],
  providers: [PrivateSharingUseCase, SequelizePrivateSharingRepository],
  exports: [PrivateSharingUseCase],
})
export class PrivateSharingModule {}
