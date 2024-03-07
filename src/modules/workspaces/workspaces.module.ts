import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { ShareModule } from '../share/share.module';
import { ShareModel } from '../share/share.repository';
import { FileModel } from '../file/file.model';
import { WorkspacesController } from './workspaces.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel]),
    forwardRef(() => FileModule),
    forwardRef(() => ShareModule),
    FolderModule,
    NotificationModule,
    UserModule,
    ShareModule,
  ],
  controllers: [WorkspacesController],
  providers: [Logger],
})
export class WorkspacesModule {}
