import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
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
import { DeleteExpiredTrashItemsTask } from './tasks/delete-expired-trash-items.task';
import { TrashModule } from '../trash/trash.module';

@Module({
  imports: [
    SequelizeModule.forFeature([JobExecutionModel]),
    ScheduleModule.forRoot(),
    FileModule,
    FolderModule,
    UserModule,
    TrashModule,
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
    DeleteExpiredTrashItemsTask,
  ],
})
export class JobsModule {}
