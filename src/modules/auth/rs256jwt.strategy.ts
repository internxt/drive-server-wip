import { BasicStrategy as Strategy } from 'passport-http';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { Inject } from '@nestjs/common';
import { UserUseCases } from '../user/user.usecase';

export class RS256JwtStrategy extends PassportStrategy(Strategy, 'rs256jwt') {
  constructor(
    @Inject(UserUseCases)
    private userUseCases: UserUseCases,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('secrets.gateway.publicKey'),
      algorithms: ['RS256'],
    });
  }

  async validate(): Promise<boolean> {
    return true;
  }
}
