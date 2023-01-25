import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FolderModel, SequelizeFolderRepository } from './folder.repository';
import { FolderUseCases } from './folder.usecase';
import { FileModule } from '../file/file.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { SequelizeUserRepository, UserModel } from '../user/user.repository';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderController } from './folder.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([FolderModel, UserModel]),
    forwardRef(() => FileModule),
    CryptoModule,
  ],
  controllers: [FolderController],
  providers: [
    SequelizeFolderRepository,
    SequelizeUserRepository,
    CryptoService,
    FolderUseCases,
  ],
  exports: [FolderUseCases, SequelizeFolderRepository],
})
export class FolderModule {}
