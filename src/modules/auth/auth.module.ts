import { KeyServerModule } from './../keyserver/key-server.module';
import { CryptoService } from './../../externals/crypto/crypto.service';
import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { UserUseCases } from '../user/user.usecase';
import { BasicStrategy } from './basic.strategy';
import { GatewayRS256JwtStrategy } from './gateway-rs256jwt.strategy';
import { AuthController } from './auth.controller';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { AuthUsecases } from './auth.usecase';
import { CaptchaService } from '../../externals/captcha/captcha.service';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    PassportModule.register({ defaultStrategy: JwtStrategy.id }),
    JwtModule.registerAsync({
      imports: [ConfigModule, UserModule],
      inject: [ConfigService, UserUseCases],
      useFactory: async (configService: ConfigService) => {
        return {
          secret: configService.get('secrets.jwt'),
          signOptions: {
            expiresIn: 3600, // 1 hour
          },
        };
      },
    }),
    KeyServerModule,
    forwardRef(() => WorkspacesModule),
    CacheManagerModule,
    FeatureLimitModule,
  ],
  providers: [
    CaptchaService,
    JwtStrategy,
    BasicStrategy,
    GatewayRS256JwtStrategy,
    CryptoService,
    SequelizeWorkspaceRepository,
    TwoFactorAuthService,
    AuthUsecases,
  ],
  controllers: [AuthController],
  exports: [JwtStrategy, BasicStrategy, PassportModule],
})
export class AuthModule {}
