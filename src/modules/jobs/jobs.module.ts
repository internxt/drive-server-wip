import { Module } from '@nestjs/common';
import { DeletedItemsCleanupTask } from './tasks/deleted-items-cleanup.task';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import { SequelizeJobExecutionRepository } from './repositories/job-execution.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { JobExecutionModel } from './models/job-execution.model';
import { RedisService } from './services/redis.service';
import { ScheduleModule } from '@nestjs/schedule';

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
  ],
})
export class JobsModule {}
