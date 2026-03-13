import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { ReferralService } from './referral.service';

@Injectable()
export class CelloReferralService extends ReferralService {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  generateToken(productUserId: string, signupDate: Date): string {
    const productId = this.configService.get<string>('cello.productId');
    const productSecret = this.configService.get<string>('cello.productSecret');
    const now = Math.floor(Date.now() / 1000);

    return sign(
      {
        productId,
        productUserId,
        signupDate: signupDate.toISOString(),
        iat: now,
        exp: now + 3600,
      },
      productSecret,
      { algorithm: 'HS512' },
    );
  }
}
