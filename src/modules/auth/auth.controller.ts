import {
  Body,
  Controller,
  HttpCode,
  Post,
  Logger,
  NotFoundException,
  UseGuards,
  Get,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { ReferralKey, User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '../../guards/throttler.guard';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access-dto';
import { User as UserDecorator } from './decorators/user.decorator';
import { Client } from './decorators/client.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private userUseCases: UserUseCases,
    private readonly keyServerUseCases: KeyServerUseCases,
    private readonly cryptoService: CryptoService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get security details to log in',
  })
  @ApiResponse({ status: 200, description: 'Retrieve details' })
  @Public()
  async login(@Body() body: LoginDto, @Client() clientId: string) {
    const user = await this.userUseCases.findByEmail(body.email);

    if (!user) {
      throw new NotFoundException('Invalid credentials');
    }

    try {
      const encryptedSalt = this.cryptoService.encryptText(
        user.hKey.toString(),
      );
      const required2FA = Boolean(
        user.secret_2FA && user.secret_2FA.length > 0,
      );
      const hasKeys = await this.keyServerUseCases.findUserKeys(user.id);

      if (clientId === 'drive-mobile') {
        this.userUseCases
          .applyReferral(user.id, ReferralKey.InstallMobileApp)
          .catch((err) => {
            this.userUseCases.logReferralError(user.id, err);
          });
      }

      if (clientId === 'drive-desktop') {
        this.userUseCases
          .applyReferral(user.id, ReferralKey.InstallDesktopApp)
          .catch((err) => {
            this.userUseCases.logReferralError(user.id, err);
          });
      }

      return { hasKeys, sKey: encryptedSalt, tfa: required2FA };
    } catch (err) {
      Logger.error(
        `[AUTH/LOGIN] USER: ${user.email} ERROR: ${
          (err as Error).message
        }, STACK: ${(err as Error).stack}`,
      );
      throw err;
    }
  }

  @UseGuards(ThrottlerGuard)
  @Post('/login/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access user account',
  })
  @ApiResponse({
    status: 200,
    description: 'User  successfully accessed their account',
  })
  @Public()
  async loginAccess(@Body() body: LoginAccessDto) {
    return this.userUseCases.loginAccess(body);
  }

  @Get('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out of the account',
  })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@UserDecorator() user: User) {
    return { logout: true };
  }
}
