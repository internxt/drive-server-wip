import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';

const strategyId = 'gateway.jwt.rs256';
@Injectable()
export class GatewayRS256JwtStrategy extends PassportStrategy(
  Strategy,
  strategyId,
) {
  static readonly id = strategyId;
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: Buffer.from(
        configService.get('secrets.driveGateway'),
        'base64',
      ).toString('utf8'),
      algorithms: ['RS256'],
    });
  }

  async validate(): Promise<boolean> {
    return true;
  }
}
