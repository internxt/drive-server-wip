import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  DeletedItemsCleanupScheduler,
  DELETED_ITEMS_CLEANUP_QUEUE,
} from './tasks/deleted-items-cleanup/deleted-items-cleanup.scheduler';
import { DeletedItemsCleanupProcessor } from './tasks/deleted-items-cleanup/deleted-items-cleanup.processor';
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
import {
  HardDeleteOldFilesScheduler,
  HARD_DELETE_OLD_FILES_QUEUE,
} from './tasks/hard-delete-old-files/hard-delete-old-files.scheduler';
import { HardDeleteOldFilesProcessor } from './tasks/hard-delete-old-files/hard-delete-old-files.processor';
import {
  CleanupDeletedFilesTableScheduler,
  CLEANUP_DELETED_FILES_TABLE_QUEUE,
} from './tasks/cleanup-deleted-files-table/cleanup-deleted-files-table.scheduler';
import { CleanupDeletedFilesTableProcessor } from './tasks/cleanup-deleted-files-table/cleanup-deleted-files-table.processor';
import { SequelizeDeletedFilesRepository } from './repositories/deleted-files.repository';
import { buildBullConnectionOptions } from '../../lib/bull-connection';

@Module({
  imports: [
    SequelizeModule.forFeature([JobExecutionModel]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildBullConnectionOptions(configService),
      }),
    }),
    BullModule.registerQueue({ name: TRASH_CLEANUP_QUEUE }),
    BullModule.registerQueue({ name: HARD_DELETE_OLD_FILES_QUEUE }),
    BullModule.registerQueue({
      name: CLEANUP_DELETED_FILES_TABLE_QUEUE,
    }),
    BullModule.registerQueue({ name: DELETED_ITEMS_CLEANUP_QUEUE }),
    FileModule,
    FolderModule,
    UserModule,
    MailerModule,
    FeatureLimitModule,
    SecurityModule,
  ],
  providers: [
    DeletedItemsCleanupScheduler,
    DeletedItemsCleanupProcessor,
    RedisService,
    SequelizeJobExecutionRepository,
    RetroActiveDeleteItemsCleanupTask,
    InactiveUsersEmailTask,
    DeleteExpiredFileVersionsTask,
    TrashCleanupScheduler,
    TrashCleanupProcessor,
    HardDeleteOldFilesScheduler,
    HardDeleteOldFilesProcessor,
    CleanupDeletedFilesTableScheduler,
    CleanupDeletedFilesTableProcessor,
    SequelizeDeletedFilesRepository,
  ],
})
export class JobsModule {}
