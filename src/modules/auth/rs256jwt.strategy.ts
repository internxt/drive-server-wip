import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';

const strategyId = 'jwt.rs256';
@Injectable()
export class RS256JwtStrategy extends PassportStrategy(Strategy, strategyId) {
  static id = strategyId;
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: Buffer.from(
        configService.get('secrets.gateway') as string,
        'base64',
      ).toString('utf8'),
      algorithms: ['RS256'],
    });
  }

  async validate(): Promise<boolean> {
    return true;
  }
}
