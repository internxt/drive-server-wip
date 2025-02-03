import { Module } from '@nestjs/common';
import { kyberProvider } from './providers/kyber.provider';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';

@Module({
  imports: [],
  providers: [kyberProvider, AsymmetricEncryptionService],
  exports: [AsymmetricEncryptionService],
})
export class AsymmetricEncryptionModule {}
