import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FolderModel, SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FileModule } from '../file/file.module';
import { UserModel } from '../user/user.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel, UserModel]),
    forwardRef(() => FileModule),
  ],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderUseCases],
  exports: [FolderUseCases],
})
export class FolderModule {}
