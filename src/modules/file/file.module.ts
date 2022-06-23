import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { FileModel } from './file.repository';

@Module({
  imports: [SequelizeModule.forFeature([FileModel])],
  controllers: [],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases],
})
export class FileModule {}
