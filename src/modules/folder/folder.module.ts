import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FolderModel, SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FileModule } from '../file/file.module';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { CryptoService } from 'src/externals/crypto/crypto';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel, UserModel]),
    forwardRef(() => FileModule),
  ],
  controllers: [],
  providers: [
    SequelizeFolderRepository,
    SequelizeUserRepository,
    CryptoService,
    FolderUseCases,
  ],
  exports: [FolderUseCases, SequelizeFolderRepository],
})
export class FolderModule {}
