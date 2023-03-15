import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
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
import { PoolOptions } from 'sequelize';
import { UncaughtExceptionMiddleware } from './middlewares/uncaught-exception.middleware';

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
      useFactory: async (configService: ConfigService) => {
        const poolConfig: PoolOptions = {
          max: configService.get('database.pool.maxConnections'),
          min: configService.get('database.pool.minConnections'),
          idle: configService.get('database.pool.maxIdleConnectionTime'),
          acquire: configService.get('database.pool.maxAcquireConnectionTime'),
        };

        Logger.log(
          `Database connection started with the following config: ${JSON.stringify(
            poolConfig,
          )}`,
        );

        return {
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
          pool: poolConfig,
          dialectOptions: configService.get('isProduction')
            ? {
                ssl: {
                  require: true,
                  rejectUnauthorized: false,
                },
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
        };
      },
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 5,
    }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UncaughtExceptionMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
