import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../storage/file/file.module';
import { FolderModule } from '../storage/folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';
import { TrashUseCases } from './trash.usecase';
import { ShareModule } from '../share/share.module';
import { ShareModel } from '../share/share.repository';
import { FileModel } from '../storage/file/file.model';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel]),
    forwardRef(() => FileModule),
    forwardRef(() => ShareModule),
    forwardRef(() => WorkspacesModule),
    forwardRef(() => SharingModule),
    FolderModule,
    NotificationModule,
    UserModule,
    ShareModule,
    NotificationModule,
  ],
  controllers: [TrashController],
  providers: [Logger, TrashUseCases],
})
export class TrashModule {}
