import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';
import { TrashUseCases } from './trash.usecase';
import { ShareModule } from '../share/share.module';
import { ShareModel } from '../share/share.repository';
import { FileModel } from '../file/file.model';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ShareModel]),
    forwardRef(() => FileModule),
    forwardRef(() => ShareModule),
    forwardRef(() => WorkspacesModule),
    FolderModule,
    NotificationModule,
    UserModule,
    ShareModule,
  ],
  controllers: [TrashController],
  providers: [Logger, TrashUseCases],
})
export class TrashModule {}
