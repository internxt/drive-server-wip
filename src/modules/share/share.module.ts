import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModel } from '../file/file.repository';
import { FolderModel } from '../folder/folder.repository';
import { UserModel } from '../user/user.repository';
import { ShareController } from './share.controller';
import { SequelizeShareRepository, ShareModel } from './share.repository';
import { ShareUseCases } from './share.usecase';

@Module({
  imports: [
    SequelizeModule.forFeature([ShareModel, FileModel, FolderModel, UserModel]),
  ],
  controllers: [ShareController],
  providers: [SequelizeShareRepository, ShareUseCases],
})
export class ShareModule {}
