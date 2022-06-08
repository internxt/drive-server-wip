import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { Folder } from './folder.model';
import { FolderService } from './folder.service';

@Module({
  imports: [SequelizeModule.forFeature([Folder])],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderService],
  exports: [FolderService],
})
export class FolderModule {}
