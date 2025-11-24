import { Module, forwardRef } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { TrashController } from './trash.controller';
import { TrashUseCases } from './trash.usecase';
import { FileModel } from '../file/file.model';
import { TrashModel } from './trash.model';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SharingModule } from '../sharing/sharing.module';
import { TrashEventHandler } from './handlers/trash-event.handler';
import { RedisService } from '../../externals/redis/redis.service';
import { SequelizeTrashRepository } from './trash.repository';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, TrashModel]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
    forwardRef(() => WorkspacesModule),
    forwardRef(() => SharingModule),
    NotificationModule,
    UserModule,
    FeatureLimitModule,
  ],
  controllers: [TrashController],
  providers: [
    Logger,
    TrashUseCases,
    RedisService,
    TrashEventHandler,
    SequelizeTrashRepository,
  ],
  exports: [TrashUseCases, SequelizeTrashRepository],
})
export class TrashModule {}
