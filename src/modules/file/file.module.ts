import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { ShareModel } from '../share/share.repository';
import { ShareModule } from '../share/share.module';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { FileController } from './file.controller';
import { FolderModule } from '../folder/folder.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { FileModel } from './file.model';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel, ThumbnailModel]),
    forwardRef(() => ShareModule),
    forwardRef(() => FolderModule),
    forwardRef(() => ThumbnailModule),
    forwardRef(() => SharingModule),
    BridgeModule,
    CryptoModule,
  ],
  controllers: [FileController],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases, SequelizeFileRepository],
})
export class FileModule {}
