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
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload): Promise<User> {
    const { username } = payload.payload;
    let user = await this.userUseCases.getUserByUsername(username);
    const isGuest = user?.bridgeUser && user?.email !== user.bridgeUser;
    if (isGuest) {
      user = await this.userUseCases.getUserByUsername(user.bridgeUser);
    }
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
