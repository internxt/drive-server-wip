import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileService } from './file.usecase';
import { FileModel } from './file.repository';

@Module({
  imports: [SequelizeModule.forFeature([FileModel])],
  controllers: [],
  providers: [SequelizeFileRepository, FileService],
  exports: [FileService],
})
export class FileModule {}
