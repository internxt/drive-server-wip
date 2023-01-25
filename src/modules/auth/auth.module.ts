import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
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
          signOptions: {
            expiresIn: 3600, // 1 hour
          },
        };
      },
    }),
  ],
  providers: [JwtStrategy, BasicStrategy],
  controllers: [],
  exports: [JwtStrategy, BasicStrategy, PassportModule],
})
export class AuthModule {}
