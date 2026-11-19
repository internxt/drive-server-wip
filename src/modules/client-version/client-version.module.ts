import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { SequelizeModule } from '@nestjs/sequelize';
import { ClientVersionPolicyModel } from './client-version-policy.model';
import {
  ClientVersionPolicyRepository,
  SequelizeClientVersionPolicyRepository,
} from './client-version-policy.repository';
import { ClientVersionController } from './client-version.controller';
import { ClientVersionUseCase } from './client-version.usecase';
import { OutdatedClientNotificationService } from './outdated-client-notification/outdated-client-notification.service';
import { buildBullConnectionOptions } from '../../lib/bull-connection';
import { OUTDATED_CLIENT_EMAIL_QUEUE } from '../jobs/tasks/outdated-client-email/outdated-client-email.processor';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([ClientVersionPolicyModel]),
    ConditionalModule.registerWhen(
      BullModule.registerQueueAsync({
        name: OUTDATED_CLIENT_EMAIL_QUEUE,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          connection: buildBullConnectionOptions(configService),
        }),
      }),
      (env) => !!env.REDIS_JOBS_CONNECTION_STRING,
    ),
  ],
  controllers: [ClientVersionController],
  providers: [
    {
      provide: ClientVersionPolicyRepository,
      useClass: SequelizeClientVersionPolicyRepository,
    },
    ClientVersionUseCase,
    OutdatedClientNotificationService,
  ],
  exports: [ClientVersionUseCase, OutdatedClientNotificationService],
})
export class ClientVersionModule {}
