import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { FileModule } from './modules/file/file.module';
import { TrashModule } from './modules/trash/trash.module';
import { FolderModule } from './modules/folder/folder.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import configuration from './config/configuration';
import { NotificationModule } from './externals/notifications/notifications.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
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
import { APP_FILTER } from '@nestjs/core';
import { HttpGlobalExceptionFilter } from './common/http-global-exception-filter.exception';
import { JobsModule } from './modules/jobs/jobs.module';
import { v4 } from 'uuid';
import { getClientIdFromHeaders } from './common/decorators/client.decorator';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        name: 'drive-server',
        genReqId: (req) => req.headers['x-request-id'] ?? v4(),
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        customProps: (req: any) => ({
          userId: req?.user?.uuid,
          userEmail: req?.user?.email,
        }),
        serializers: {
          req: (req) => ({
            requestId: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
            headers: {
              'content-type': req.headers['content-type'],
              'user-agent': req.headers['user-agent'],
              'internxt-client': getClientIdFromHeaders(req),
              'internxt-version': req.headers['internxt-version'],
              'request-id': req.headers['x-request-id'],
            },
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        redact: ['req.headers.authorization'],
        autoLogging: false,
      },
    }),
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`],
      load: [configuration],
      isGlobal: true,
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
            }
          : {},
        logging: !configService.get('database.debug')
          ? false
          : (sql: string) => {
              const logger = new Logger('SequelizeSQL');
              try {
                const oneLineQuery = sql
                  .replace(/^Executing \([^)]+\):\s*/, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                logger.debug(oneLineQuery);
              } catch (error) {
                logger.debug(`Failed to format sql`, sql);
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
    JobsModule,
    NotificationModule,
    NotificationsModule,
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
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpGlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
