import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FolderModel } from './folder.repository';

@Module({
  imports: [SequelizeModule.forFeature([FolderModel])],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderUseCases],
  exports: [FolderUseCases],
})
export class FolderModule {}
