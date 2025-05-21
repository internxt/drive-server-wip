import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { FolderModule } from './folder/folder.module';

@Module({
  imports: [FileModule, FolderModule],
})
export class StorageModule {}
