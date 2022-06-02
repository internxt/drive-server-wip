import { Logger, Module } from '@nestjs/common';
import { FileModule } from 'src/modules/file/file.module';
import { FolderModule } from 'src/modules/folder/folder.module';
import { TrashController } from './trash.controller';
// import { SequelizeModule } from '@nestjs/sequelize';
import { TrashService } from './trash.service';

@Module({
  imports: [FileModule, FolderModule],
  controllers: [TrashController],
  providers: [TrashService, Logger],
})
export class TrashModule {}
