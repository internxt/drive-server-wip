import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DeletedItemsCleanupTask } from './tasks/deleted-items-cleanup.task';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import { SequelizeJobExecutionRepository } from './repositories/job-execution.repository';
import { JobExecutionModel } from './models/job-execution.model';
import { RetroActiveDeleteItemsCleanupTask } from './tasks/retroactive-items-cleanup.task';
import { RedisService } from '../../externals/redis/redis.service';
import { InactiveUsersEmailTask } from './tasks/inactive-users-email.task';
import { MailerModule } from '../../externals/mailer/mailer.module';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { SecurityModule } from '../security/security.module';
import { DeleteExpiredFileVersionsTask } from './tasks/delete-expired-file-versions.task';
import {
  TrashCleanupScheduler,
  TRASH_CLEANUP_QUEUE,
} from './tasks/trash-cleanup/trash-cleanup.scheduler';
import { TrashCleanupProcessor } from './tasks/trash-cleanup/trash-cleanup.processor';
@Module({
  imports: [
    SequelizeModule.forFeature([JobExecutionModel]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = new URL(
          configService.get<string>('cache.redisJobsConnection'),
        );
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            username: url.username || undefined,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            tls: {},
          },
        };
      },
    }),
    BullModule.registerQueue({ name: TRASH_CLEANUP_QUEUE }),
    FileModule,
    FolderModule,
    UserModule,
    MailerModule,
    FeatureLimitModule,
    SecurityModule,
  ],
  providers: [
    DeletedItemsCleanupTask,
    RedisService,
    SequelizeJobExecutionRepository,
    RetroActiveDeleteItemsCleanupTask,
    InactiveUsersEmailTask,
    DeleteExpiredFileVersionsTask,
    TrashCleanupScheduler,
    TrashCleanupProcessor,
  ],
})
export class JobsModule {}
