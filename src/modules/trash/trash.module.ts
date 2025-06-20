import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';
import { TrashUseCases } from './trash.usecase';
import { FileModel } from '../file/file.model';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel]),
    forwardRef(() => FileModule),
    forwardRef(() => WorkspacesModule),
    forwardRef(() => SharingModule),
    FolderModule,
    NotificationModule,
    UserModule,
    NotificationModule,
  ],
  controllers: [TrashController],
  providers: [Logger, TrashUseCases],
})
export class TrashModule {}
