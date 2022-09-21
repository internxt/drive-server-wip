import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FolderModel } from './folder.repository';
import { FileModule } from '../file/file.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel]),
    forwardRef(() => FileModule),
    CryptoModule,
  ],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderUseCases],
  exports: [FolderUseCases],
})
export class FolderModule {}
