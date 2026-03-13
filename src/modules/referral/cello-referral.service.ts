import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { ReferralService } from './referral.service';

@Injectable()
export class CelloReferralService extends ReferralService {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  generateToken(productUserId: string): string {
    const productId = this.configService.get<string>('cello.productId');
    const productSecret = this.configService.get<string>('cello.productSecret');

    return sign(
      {
        productId,
        productUserId,
        iat: Math.floor(Date.now() / 1000),
      },
      productSecret,
      { algorithm: 'HS512' },
    );
  }
}
