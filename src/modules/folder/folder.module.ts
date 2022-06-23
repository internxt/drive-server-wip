import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FolderModel } from './folder.repository';
import { FileModule } from '../file/file.module';

@Module({
  imports: [SequelizeModule.forFeature([FolderModel]), FileModule],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderUseCases],
  exports: [FolderUseCases],
})
export class FolderModule {}
