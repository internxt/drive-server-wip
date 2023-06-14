import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { ThumbnailModel } from './thumbnail.model';

@Module({
  imports: [
    SequelizeModule.forFeature([ThumbnailModel]),
    // forwardRef(() => FileModule),
  ],
  //   controllers: [ThumbnailController],
  providers: [SequelizeThumbnailRepository],
  //   exports: [ThumbnailUseCases],
})
export class ThumbnailModule {}
