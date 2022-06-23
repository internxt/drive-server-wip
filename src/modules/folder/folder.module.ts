import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FolderModel } from './folder.repository';
import { FileModule } from '../file/file.module';
import { SendLinkItemModel } from '../send/models/send-link-item.model';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel, SendLinkItemModel]),
    FileModule,
  ],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderUseCases],
  exports: [FolderUseCases],
})
export class FolderModule {}
