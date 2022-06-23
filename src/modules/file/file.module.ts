import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { FileModel } from './file.repository';
import { SendLinkItemModel } from '../send/models/send-link-item.model';

@Module({
  imports: [SequelizeModule.forFeature([FileModel, SendLinkItemModel])],
  controllers: [],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases],
})
export class FileModule {}
