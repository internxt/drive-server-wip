import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { FileUseCases } from './file.usecase';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { FileController } from './file.controller';
import { FolderModule } from '../folder/folder.module';
import { ThumbnailModel } from '../thumbnail/thumbnail.model';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { FileModel } from './file.model';
import { FileVersionModel } from './file-version.model';
import { SequelizeFileVersionRepository } from './file-version.repository';
import { SharingModule } from '../sharing/sharing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UsageModule } from '../usage/usage.module';
import { MailerService } from '../../externals/mailer/mailer.service';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { RedisService } from '../../externals/redis/redis.service';
import { TrashModule } from '../trash/trash.module';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { CustomEndpointThrottleGuard } from '../../guards/custom-endpoint-throttle.guard';
import {
  DeleteFileVersionAction,
  GetFileVersionsAction,
  CreateFileVersionAction,
} from './actions';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, FileVersionModel, ThumbnailModel]),
    forwardRef(() => FolderModule),
    forwardRef(() => ThumbnailModule),
    forwardRef(() => SharingModule),
    forwardRef(() => WorkspacesModule),
    BridgeModule,
    CryptoModule,
    UserModule,
    NotificationModule,
    UsageModule,
    FeatureLimitModule,
    forwardRef(() => TrashModule),
    CacheManagerModule,
  ],
  controllers: [FileController],
  providers: [
    SequelizeFileRepository,
    SequelizeFileVersionRepository,
    FileUseCases,
    MailerService,
    RedisService,
    CustomEndpointThrottleGuard,
    GetFileVersionsAction,
    DeleteFileVersionAction,
    CreateFileVersionAction,
  ],
  exports: [
    FileUseCases,
    SequelizeModule,
    SequelizeFileRepository,
    SequelizeFileVersionRepository,
  ],
})
export class FileModule {}
