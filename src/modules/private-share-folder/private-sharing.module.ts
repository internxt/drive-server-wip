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
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderModel,
      PrivateSharingRoleModel,
      FolderModel,
      PrivateSharingFolderRolesModel,
      UserModel,
    ]),
    forwardRef(() => UserModule),
    FolderModule,
    FileModule,
  ],
  providers: [
    SequelizePrivateSharingRepository,
    PrivateSharingUseCase,
    SequelizeUserRepository,
    PrivateSharingFolderRolesRepository,
  ],
  controllers: [PrivateSharingController],
  exports: [PrivateSharingUseCase],
})
export class PrivateSharingModule {}
