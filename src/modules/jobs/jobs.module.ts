import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeletedItemsCleanupTask } from './tasks/deleted-items-cleanup.task';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import { SequelizeJobExecutionRepository } from './repositories/job-execution.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { JobExecutionModel } from './models/job-execution.model';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    SequelizeModule.forFeature([JobExecutionModel]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: await configService.get('jobs.queueConnectionString'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'cleanup-process',
    }),
    FileModule,
    FolderModule,
    UserModule,
  ],
  providers: [DeletedItemsCleanupTask, SequelizeJobExecutionRepository],
})
export class JobsModule {}
