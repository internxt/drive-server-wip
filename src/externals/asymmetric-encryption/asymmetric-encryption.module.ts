import { Module } from '@nestjs/common';
import { KyberProvider } from './providers/kyber.provider';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';

@Module({
  imports: [],
  providers: [KyberProvider, AsymmetricEncryptionService],
  exports: [AsymmetricEncryptionService],
})
export class AsymmetricEncryptionModule {}
