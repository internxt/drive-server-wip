import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { FileModel } from './file.repository';
import { ShareModel } from '../share/share.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel]),
    forwardRef(() => ShareModel),
  ],
  controllers: [],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases],
})
export class FileModule {}
