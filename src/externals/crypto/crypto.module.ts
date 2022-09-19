import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../../../src/config/configuration';
import { CryptoService } from './crypto';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`],
      load: [configuration],
      isGlobal: true,
    }),
  ],
  providers: [
    {
      provide: CryptoService,
      useFactory: (configService: ConfigService) => {
        return CryptoService.getInstance(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
