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

@Module({
  imports: [
    SequelizeModule.forFeature([JobExecutionModel]),
    ScheduleModule.forRoot(),
    FileModule,
    FolderModule,
    UserModule,
  ],
  providers: [
    DeletedItemsCleanupTask,
    RedisService,
    SequelizeJobExecutionRepository,
    RetroActiveDeleteItemsCleanupTask,
  ],
})
export class JobsModule {}
