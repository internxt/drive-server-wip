import {
  Inject,
  UnauthorizedException,
  Logger,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { Time } from '../../lib/time';

export interface JwtPayload {
  email: string;
  bridgeUser: string;
}

const strategyId = 'jwt.standard';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, strategyId) {
  static id = strategyId;

  constructor(
    @Inject(UserUseCases)
    private readonly userUseCases: UserUseCases,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('secrets.jwt'),
    });
  }

  async validate(payload): Promise<User> {
    try {
      if (!payload.payload || !payload.payload.uuid) {
        throw new UnauthorizedException('Old token version detected');
      }
      const { uuid } = payload.payload;
      const user = await this.userUseCases.getUser(uuid);
      if (!user) {
        throw new UnauthorizedException();
      }

      const userWithoutLastPasswordChangedAt =
        user.lastPasswordChangedAt === null;

      const tokenIssuedBeforeLastPasswordChange =
        user.lastPasswordChangedAt &&
        user.lastPasswordChangedAt > Time.convertTimestampToDate(payload.iat);

      if (
        !userWithoutLastPasswordChangedAt &&
        tokenIssuedBeforeLastPasswordChange
      ) {
        throw new UnauthorizedException();
      }

      if (user.isGuestOnSharedWorkspace()) {
        return this.userUseCases.getUserByUsername(user.bridgeUser);
      }

      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      Logger.error(
        `[AUTH/MIDDLEWARE] ERROR validating authorization ${
          err.message
        }, token payload ${payload}, STACK: ${(err as Error).stack},`,
      );
      throw new UnauthorizedException();
    }
  }
}
