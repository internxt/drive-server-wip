import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { File } from './file.model';
import { FileService } from './file.service';

@Module({
  imports: [SequelizeModule.forFeature([File])],
  controllers: [],
  providers: [SequelizeFileRepository, FileService],
  exports: [FileService],
})
export class FileModule {}
