import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { ThumbnailModel } from './thumbnail.model';
import { ThumbnailUseCases } from './thumbnail.usecase';
import { BridgeModule } from '../../externals/bridge/bridge.module';

@Module({
  imports: [SequelizeModule.forFeature([ThumbnailModel]), BridgeModule],
  providers: [SequelizeThumbnailRepository, ThumbnailUseCases],
  exports: [ThumbnailUseCases, SequelizeThumbnailRepository],
})
export class ThumbnailModule {}
