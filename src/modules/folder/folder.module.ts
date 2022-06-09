import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderService } from './folder.usecase';
import { FolderModel } from './folder.repository';

@Module({
  imports: [SequelizeModule.forFeature([FolderModel])],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderService],
  exports: [FolderService],
})
export class FolderModule {}
