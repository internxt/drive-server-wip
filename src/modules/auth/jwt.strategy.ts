import { Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';

export interface JwtPayload {
  email: string;
  bridgeUser: string;
}

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(UserUseCases)
    private userUseCases: UserUseCases,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('secrets.jwt'),
    });
  }

  async validate(payload): Promise<User> {
    const { username } = payload.payload;
    const user = await this.userUseCases.getUserByUsername(username);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
