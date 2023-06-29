import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserUseCases } from '../user/user.usecase';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/user.domain';

@Injectable()
export class AllowOldJwtStrategy extends PassportStrategy(
  Strategy,
  'allow-old-jwt',
) {
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
    const uuid = payload.payload?.uuid;
    if (uuid) {
      const user = await this.userUseCases.getUser(uuid);
      if (user) {
        return user;
      }
    }

    return null;
  }
}
