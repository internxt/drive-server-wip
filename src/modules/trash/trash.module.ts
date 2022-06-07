import { Logger, Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';

@Module({
  imports: [FileModule, FolderModule, NotificationModule, UserModule],
  controllers: [TrashController],
  providers: [Logger],
})
export class TrashModule {}
