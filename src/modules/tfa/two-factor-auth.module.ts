import { Module } from '@nestjs/common';
import { CryptoModule } from './../../externals/crypto/crypto.module';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule, CryptoModule],
  controllers: [TwoFactorAuthController],
  providers: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {}
