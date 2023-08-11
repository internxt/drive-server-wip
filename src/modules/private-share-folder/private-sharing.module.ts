import { Module, forwardRef } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { UserModule } from '../user/user.module';
import { PrivateSharingRoleModel } from './private-sharing-role.model';
import { FolderModel } from '../folder/folder.repository';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderModel,
      PrivateSharingFolderRolesModel,
      PrivateSharingRoleModel,
      FolderModel,
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
  ],
  controllers: [PrivateSharingController],
  exports: [PrivateSharingUseCase],
})
export class PrivateSharingModule {}
