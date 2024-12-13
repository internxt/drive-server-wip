import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  Logger,
  Req,
  NotFoundException,
  UseGuards,
  Request as RequestDecorator,
  Get,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Response, Request } from 'express';
import { ReferralKey, User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '../../guards/throttler.guard';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access-dto';
import { User as UserDecorator } from './decorators/user.decorator';

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
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get security details to log in',
  })
  @ApiResponse({ status: 200, description: 'Retrieve details' })
  @Public()
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const internxtClient = req.headers['internxt-client'];

    const user = await this.userUseCases.findByEmail(body.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const encSalt = this.cryptoService.encryptText(user.hKey.toString());
      const required2FA = user.secret_2FA && user.secret_2FA.length > 0;

      const hasKeys = await this.keyServerUseCases.findUserKeys(user.id);

      if (internxtClient === 'drive-mobile') {
        this.userUseCases
          .applyReferral(user.id, ReferralKey.InstallMobileApp)
          .catch((err) => {
            this.userUseCases.logReferralError(user.id, err);
          });
      }

      if (internxtClient === 'drive-desktop') {
        this.userUseCases
          .applyReferral(user.id, ReferralKey.InstallDesktopApp)
          .catch((err) => {
            this.userUseCases.logReferralError(user.id, err);
          });
      }

      return res.status(200).send({ hasKeys, sKey: encSalt, tfa: required2FA });
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
  @HttpCode(200)
  @ApiOperation({
    summary: 'Access account',
  })
  @ApiResponse({
    status: 200,
    description: 'Allow the user to access their account',
  })
  @Public()
  async loginAccess(@Body() body: LoginAccessDto) {
    return this.userUseCases.loginAccess(body);
  }

  @Get('/logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout account',
  })
  @ApiResponse({ status: 200, description: 'Register log logout' })
  async logout(@UserDecorator() user: User, @Res() res: Response) {
    return res.send({ logout: true });
  }
}
