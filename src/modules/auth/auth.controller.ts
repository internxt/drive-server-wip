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
  ConflictException,
  BadRequestException,
  Delete,
  Put,
  UnauthorizedException,
  HttpException,
  UseFilters,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '../../guards/throttler.guard';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access.dto';
import { User as UserDecorator } from './decorators/user.decorator';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogType } from '../workspaces/attributes/workspace-logs.attributes';
import { ExtendedHttpExceptionFilter } from '../../common/http-exception-filter-extended.exception';
import { AreCredentialsCorrectDto } from './dto/are-credentials-correct.dto';

@ApiTags('Auth')
@Controller('auth')
@UseFilters(ExtendedHttpExceptionFilter)
export class AuthController {
  constructor(
    private userUseCases: UserUseCases,
    private readonly keyServerUseCases: KeyServerUseCases,
    private readonly cryptoService: CryptoService,
    private twoFactorAuthService: TwoFactorAuthService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get security details to log in',
  })
  @ApiOkResponse({ description: 'Retrieve details' })
  @Public()
  async login(@Body() body: LoginDto) {
    const email = body.email.toLowerCase();

    const user = await this.userUseCases.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Wrong login credentials');
    }

    try {
      const encryptedSalt = this.cryptoService.encryptText(
        user.hKey.toString(),
      );
      const required2FA = Boolean(
        user.secret_2FA && user.secret_2FA.length > 0,
      );
      const keys = await this.keyServerUseCases.findUserKeys(user.id);

      return {
        hasKeys: !!keys.ecc,
        sKey: encryptedSalt,
        tfa: required2FA,
        hasKyberKeys: !!keys.kyber,
        hasEccKeys: !!keys.ecc,
      };
    } catch (err) {
      if (!(err instanceof HttpException)) {
        Logger.error(
          `[AUTH/LOGIN] USER: ${user.email} ERROR: ${
            (err as Error).message
          }, STACK: ${(err as Error).stack}`,
        );
      }
      throw err;
    }
  }

  @UseGuards(ThrottlerGuard)
  @Post('/login/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access user account',
  })
  @ApiOkResponse({
    description: 'User  successfully accessed their account',
  })
  @Public()
  @WorkspaceLogAction(WorkspaceLogType.Login)
  async loginAccess(@Body() body: LoginAccessDto) {
    const { ecc, kyber } = this.keyServerUseCases.parseKeysInput(body.keys, {
      privateKey: body.privateKey,
      publicKey: body.publicKey,
      revocationKey: body.revocateKey,
    });

    return this.userUseCases.loginAccess({
      ...body,
      keys: { kyber, ecc },
    });
  }

  @Get('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out of the account',
  })
  @ApiOkResponse({ description: 'Successfully logged out' })
  @WorkspaceLogAction(WorkspaceLogType.Logout)
  async logout(@UserDecorator() user: User) {
    return { logout: true };
  }

  @Get('/tfa')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async getTfa(@UserDecorator() user: User) {
    if (user.secret_2FA) {
      throw new ConflictException('User has already 2FA');
    }
    const { secret, qrCode } =
      await this.twoFactorAuthService.generateTwoFactorAuthSecret();
    return { code: secret.base32, qr: qrCode };
  }

  @Put('/tfa')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async putTfa(
    @UserDecorator() user: User,
    @Body() updateTfaDto: UpdateTfaDto,
  ) {
    if (user.secret_2FA) {
      throw new ConflictException('User has already 2FA');
    }

    this.twoFactorAuthService.validateTwoFactorAuthCode(
      updateTfaDto.key,
      updateTfaDto.code,
    );
    await this.userUseCases.updateByUuid(user.uuid, {
      secret_2FA: updateTfaDto.key,
    });

    return { message: 'ok' };
  }

  @Delete('/tfa')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async deleteTfa(
    @UserDecorator() user: User,
    @Body() deleteTfaDto: DeleteTfaDto,
  ) {
    if (!user.secret_2FA) {
      throw new NotFoundException('Your account does not have 2FA activated.');
    }

    this.twoFactorAuthService.validateTwoFactorAuthCode(
      user.secret_2FA,
      deleteTfaDto.code,
    );
    const decryptedPass = this.cryptoService.decryptText(deleteTfaDto.pass);

    if (user.password.toString() !== decryptedPass) {
      throw new BadRequestException('Invalid password');
    }
    await this.userUseCases.updateByUuid(user.uuid, { secret_2FA: null });
    return { message: 'ok' };
  }

  @Get('/are-credentials-correct')
  @ApiOperation({
    summary: 'Check if current user credentials are correct',
  })
  @ApiOkResponse({
    description: 'Credentials are correct',
  })
  async areCredentialsCorrect(
    @UserDecorator() user: User,
    @Query() query: AreCredentialsCorrectDto,
  ) {
    const { hashedPassword } = query;
    return this.userUseCases.areCredentialsCorrect(user, hashedPassword);
  }
}
