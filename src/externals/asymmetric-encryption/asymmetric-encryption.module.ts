import { Module } from '@nestjs/common';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';

@Module({
  imports: [],
  providers: [AsymmetricEncryptionService],
  exports: [AsymmetricEncryptionService],
})
export class AsymmetricEncryptionModule {}
