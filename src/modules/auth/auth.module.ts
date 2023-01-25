import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { RS256JwtStrategy } from './rs256jwt.strategy';
import { UserModule } from '../user/user.module';
import { UserUseCases } from '../user/user.usecase';
import { BasicStrategy } from './basic.strategy';

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
          publicKey: Buffer.from(
            configService.get('secrets.gateway') as string,
            'base64',
          ).toString('utf8'),
          signOptions: {
            expiresIn: 3600, // 1 hour
          },
        };
      },
    }),
  ],
  providers: [JwtStrategy, RS256JwtStrategy, BasicStrategy],
  controllers: [],
  exports: [JwtStrategy, BasicStrategy, RS256JwtStrategy, PassportModule],
})
export class AuthModule {}
