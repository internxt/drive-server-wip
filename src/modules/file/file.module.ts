import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { FileModel } from './file.repository';
import { ShareModel } from '../share/share.repository';
import { ShareModule } from '../share/share.module';
import { BridgeModule } from '../../externals/bridge/bridge.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel]),
    forwardRef(() => ShareModule),
    BridgeModule,
  ],
  controllers: [],
  providers: [SequelizeFileRepository, FileUseCases],
  exports: [FileUseCases],
})
export class FileModule {}
