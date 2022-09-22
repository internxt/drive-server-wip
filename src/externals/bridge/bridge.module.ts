import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoModule } from '../crypto/crypto.module';
import { HttpClientModule } from '../http/http.module';
import { BridgeService } from './bridge.service';

@Module({
  imports: [ConfigModule, HttpClientModule, CryptoModule],
  controllers: [],
  providers: [BridgeService],
  exports: [BridgeService],
})
export class BridgeModule {}
