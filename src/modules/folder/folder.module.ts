import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { FolderModel } from './folder.model';
import { FolderUseCases } from './folder.usecase';
import { FileModule } from '../file/file.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { SequelizeUserRepository } from '../user/user.repository';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderController } from './folder.controller';
import { UserModel } from '../user/user.model';

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
