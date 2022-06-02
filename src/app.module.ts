import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { SequelizeModule } from '@nestjs/sequelize';

import { FileModule } from './modules/file/file.module';
import { TrashModule } from './modules/trash/trash.module';
import { FolderModule } from './modules/folder/folder.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`],
      validationSchema: configValidationSchema
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        dialect: 'mariadb',
        autoLoadModels: true,
        synchronize: false,
        host: configService.get('RDS_HOSTNAME'),
        port: configService.get('RDS_PORT'),
        username: configService.get('RDS_USERNAME'),
        password: configService.get('RDS_PASSWORD'),
        database: configService.get('RDS_DBNAME'),
      }),
    }),
    FileModule,
    FolderModule,
    TrashModule,
    AuthModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
