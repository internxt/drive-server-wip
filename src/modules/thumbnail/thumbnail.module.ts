import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { ThumbnailModel } from './thumbnail.model';
import { ThumbnailUseCases } from './thumbnail.usecase';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { FileModel } from '../file/file.model';
import { SequelizeFileRepository } from '../file/file.repository';
import { ShareModel } from '../share/share.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([ThumbnailModel, FileModel, ShareModel]),
    BridgeModule,
  ],
  providers: [
    SequelizeThumbnailRepository,
    SequelizeFileRepository,
    ThumbnailUseCases,
  ],
  exports: [ThumbnailUseCases, SequelizeThumbnailRepository],
})
export class ThumbnailModule {}
