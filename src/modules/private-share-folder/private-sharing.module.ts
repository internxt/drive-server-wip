import { Module } from '@nestjs/common';
import { PrivateSharingController } from './private-sharing.controller';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { FolderModule } from '../folder/folder.module';
import { FolderModel } from '../folder/folder.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([PrivateSharingFolderModel, FolderModel]),
    FolderModule,
  ],
  controllers: [PrivateSharingController],
  providers: [PrivateSharingUseCase, SequelizePrivateSharingRepository],
  exports: [],
})
export class PrivateSharingModule {}
