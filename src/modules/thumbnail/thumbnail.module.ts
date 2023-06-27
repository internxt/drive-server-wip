import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { ThumbnailModel } from './thumbnail.model';

@Module({
  imports: [SequelizeModule.forFeature([ThumbnailModel])],
  providers: [SequelizeThumbnailRepository],
})
export class ThumbnailModule {}
