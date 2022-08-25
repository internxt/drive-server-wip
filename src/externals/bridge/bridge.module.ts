import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from '../crypto/crypto';
import { HttpClientModule } from '../http/http.module';
import { BridgeService } from './bridge.service';

@Module({
  imports: [ConfigModule, HttpClientModule],
  controllers: [],
  providers: [
    BridgeService,
    {
      provide: CryptoService,
      useValue: new CryptoService(),
    },
  ],
  exports: [BridgeService],
})
export class BridgeModule {}
