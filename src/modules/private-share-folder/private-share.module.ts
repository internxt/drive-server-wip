import { Module, forwardRef } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderRolesModel,
      UserModel,
      PrivateSharingFolderModel,
      FolderModel,
    ]),
    forwardRef(() => FolderModule),
    forwardRef(() => UserModule),
  ],
  controllers: [PrivateSharingController],
  providers: [
    PrivateSharingUseCase,
    SequelizePrivateSharingRepository,
    SequelizeUserRepository,
  ],
  exports: [],
})
export class PrivateShareModule {}
