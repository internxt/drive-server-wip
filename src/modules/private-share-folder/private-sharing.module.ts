import { Module } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderModel,
      PrivateSharingRoleModel,
      FolderModel,
      UserModel,
      PrivateSharingFolderRolesModel,
    ]),
    FolderModule,
  ],
  controllers: [PrivateSharingController],
  providers: [
    SequelizePrivateSharingRepository,
    PrivateSharingUseCase,
    SequelizeUserRepository,
    PrivateSharingFolderRolesRepository,
  ],
  exports: [],
})
export class PrivateSharingModule {}
