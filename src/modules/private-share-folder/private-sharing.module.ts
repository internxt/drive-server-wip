import { Module, forwardRef } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { UserModule } from '../user/user.module';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { PrivateSharingFolderRolesModule } from './private-sharing-folder-roles.module';
import { PrivateSharingFolderRolesUseCase } from './private-sharing-folder-roles.usecase';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderModel,
      PrivateSharingRoleModel,
      UserModel,
      FolderModel,
      PrivateSharingFolderRolesModel,
    ]),
    forwardRef(() => FolderModule),
    forwardRef(() => UserModule),
    PrivateSharingFolderRolesModule,
  ],
  controllers: [PrivateSharingController],
  providers: [
    PrivateSharingUseCase,
    SequelizePrivateSharingRepository,
    SequelizeUserRepository,
  ],
  exports: [],
})
export class PrivateSharingModule {}
