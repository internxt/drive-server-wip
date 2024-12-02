import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { format } from 'sql-formatter';
import { SentryModule } from '@ntegral/nestjs-sentry';
import { FileModule } from './modules/file/file.module';
import { TrashModule } from './modules/trash/trash.module';
import { FolderModule } from './modules/folder/folder.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import configuration from './config/configuration';
import { NotificationModule } from './externals/notifications/notifications.module';
import { ShareModule } from './modules/share/share.module';
import { SendModule } from './modules/send/send.module';
import { BridgeModule } from './externals/bridge/bridge.module';
import { DeviceModule } from './modules/device/device.module';
import { CryptoModule } from './externals/crypto/crypto.module';
import { SharedWorkspaceModule } from './shared-workspace/shared-workspace.module';
import { ThumbnailModule } from './modules/thumbnail/thumbnail.module';
import { FuzzySearchModule } from './modules/fuzzy-search/fuzzy-search.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { AppSumoModule } from './modules/app-sumo/app-sumo.module';
import { PlanModule } from './modules/plan/plan.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { GatewayModule } from './modules/gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`],
      load: [configuration],
      isGlobal: true,
    }),
    SentryModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        dsn: configService.get('sentry.dsn'),
        environment: configService.get('environment'),
      }),
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        dialect: 'postgres',
        autoLoadModels: true,
        synchronize: false,
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        replication: !configService.get('isDevelopment')
          ? configService.get('database.replication')
          : false,
        pool: {
          maxConnections: Number.MAX_SAFE_INTEGER,
          maxIdleTime: 30000,
          max: 20,
          min: 0,
          idle: 20000,
          acquire: 20000,
        },
        dialectOptions: configService.get('isProduction')
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
              application_name: 'drive-server-wip',
              idle_in_transaction_session_timeout: 60000,
            }
          : {},
        logging: !configService.get('database.debug')
          ? false
          : (content: string) => {
              const parse = content.match(/^(Executing \(.*\):) (.*)$/);
              if (parse) {
                const prettySql = format(parse[2]);
                Logger.debug(`${parse[1]}\n${prettySql}`);
              } else {
                Logger.debug(`Could not parse sql content: ${content}`);
              }
            },
      }),
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60,
        limit: 5,
      },
      {
        name: 'long',
        ttl: 3600,
        limit: 5,
      },
    ]),
    NotificationModule,
    FileModule,
    FolderModule,
    ShareModule,
    TrashModule,
    AuthModule,
    UserModule,
    SendModule,
    BridgeModule,
    DeviceModule,
    CryptoModule,
    SharedWorkspaceModule,
    ThumbnailModule,
    FuzzySearchModule,
    SharingModule,
    AppSumoModule,
    PlanModule,
    WorkspacesModule,
    GatewayModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
