import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

@Injectable()
export class TwoFactorAuthService {
  async generateTwoFactorAuthSecret() {
    const secret = speakeasy.generateSecret({ length: 10 });
    const url = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: 'Internxt',
    });
    try {
      const qrCode = await qrcode.toDataURL(url);
      return {
        secret: secret,
        qrCode: qrCode,
      };
    } catch {
      throw new InternalServerErrorException(
        'An error occurred while trying to generate two-factor authentication.',
      );
    }
  }

  validateTwoFactorAuthCode(secret: string, code: string) {
    const isValid = speakeasy.totp.verifyDelta({
      secret,
      token: code,
      encoding: 'base32',
      window: 2,
    });
    if (!isValid) {
      throw new BadRequestException('Invalid 2FA code');
    }
    return true;
  }
}
