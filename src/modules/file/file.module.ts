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
import { SharingModule } from '../sharing/sharing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UsageModule } from '../usage/usage.module';
import { MailerService } from '../../externals/mailer/mailer.service';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { RedisService } from '../../externals/redis/redis.service';

@Module({
  imports: [
    SequelizeModule.forFeature([FileModel, ThumbnailModel]),
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
  ],
  controllers: [FileController],
  providers: [
    SequelizeFileRepository,
    FileUseCases,
    MailerService,
    RedisService,
  ],
  exports: [FileUseCases, SequelizeModule, SequelizeFileRepository],
})
export class FileModule {}
