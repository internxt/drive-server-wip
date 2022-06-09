import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModel } from '../file/file.repository';
import { FolderModel } from '../folder/folder.repository';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareService } from './share.service';

@Module({
  imports: [SequelizeModule.forFeature([ShareModel, FileModel, FolderModel])],
  controllers: [ShareController],
  providers: [SequelizeShareRepository, ShareService],
})
export class ShareModule {}
