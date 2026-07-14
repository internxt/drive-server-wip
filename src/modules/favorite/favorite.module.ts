import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FavoriteModel } from './favorite.model';
import { SequelizeFavoriteRepository } from './favorite.repository';
import { FavoriteUseCases } from './favorite.usecase';
import { FavoriteController } from './favorite.controller';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FavoriteModel]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
  ],
  controllers: [FavoriteController],
  providers: [SequelizeFavoriteRepository, FavoriteUseCases],
  exports: [FavoriteUseCases, SequelizeFavoriteRepository, SequelizeModule],
})
export class FavoriteModule {}
