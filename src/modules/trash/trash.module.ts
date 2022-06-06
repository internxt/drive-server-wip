import { Logger, Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';
// import { SequelizeModule } from '@nestjs/sequelize';
import { TrashService } from './trash.service';

@Module({
  imports: [FileModule, FolderModule, NotificationModule, UserModule],
  controllers: [TrashController],
  providers: [TrashService, Logger],
})
export class TrashModule {}
