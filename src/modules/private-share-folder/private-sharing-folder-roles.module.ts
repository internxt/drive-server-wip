import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRolesUseCase } from './private-sharing-folder-roles.usecase';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PrivateSharingFolderRolesModel,
    ]),
  ],
  controllers: [],
  providers: [
    PrivateSharingFolderRolesUseCase, PrivateSharingFolderRolesRepository,
  ],
  exports: [PrivateSharingFolderRolesUseCase, PrivateSharingFolderRolesRepository],
})
export class PrivateSharingFolderRolesModule {}
