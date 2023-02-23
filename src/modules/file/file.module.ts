import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { FileModel } from './file.repository';
import { ShareModel } from '../share/share.repository';
import { ShareModule } from '../share/share.module';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { FileController } from './file.controller';
import { FolderModule } from '../folder/folder.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel]),
    forwardRef(() => ShareModule),
    forwardRef(() => FolderModule),
    BridgeModule,
    CryptoModule,
  ],
  controllers: [FileController],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases],
})
export class FileModule {}
