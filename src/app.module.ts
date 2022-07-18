import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { format } from 'sql-formatter';

import { FileModule } from './modules/file/file.module';
import { TrashModule } from './modules/trash/trash.module';
import { FolderModule } from './modules/folder/folder.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import configuration from './config/configuration';
import { NotificationModule } from './externals/notifications/notifications.module';
import { ShareModule } from './modules/share/share.module';
import { SendModule } from './modules/send/send.module';
@Module({
  imports: [
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
        dialectOptions: {
          keepAlive: 20000,
          statemenet_timeout: 4000,
        },
        pool: {
          maxConnections: Number.MAX_SAFE_INTEGER,
          maxIdleTime: 30000,
          max: 20,
          min: 0,
          idle: 20000,
          acquire: 20000,
        },
        logging: (content: string) => {
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
    NotificationModule,
    FileModule,
    FolderModule,
    ShareModule,
    TrashModule,
    AuthModule,
    UserModule,
    SendModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
