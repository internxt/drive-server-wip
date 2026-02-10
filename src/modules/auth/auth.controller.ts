import {
  Body,
  Controller,
  HttpCode,
  Post,
  Logger,
  NotFoundException,
  Get,
  HttpStatus,
  ConflictException,
  BadRequestException,
  Delete,
  Put,
  UnauthorizedException,
  HttpException,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { Throttle, seconds } from '@nestjs/throttler';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access.dto';
import { User as UserDecorator } from './decorators/user.decorator';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogType } from '../workspaces/attributes/workspace-logs.attributes';
import { AreCredentialsCorrectDto } from './dto/are-credentials-correct.dto';
import { AuditLog } from '../../common/audit-logs/decorators/audit-log.decorator';
import { AuditAction } from '../../common/audit-logs/audit-logs.attributes';
import { LoginAccessResponseDto } from './dto/responses/login-access-response.dto';
import { LoginResponseDto } from './dto/responses/login-response.dto';
import { JwtToken } from './decorators/get-jwt.decorator';
import { AuthUsecases } from './auth.usecase';
import { ClientToPlatformMap, PlatformName } from '../../common/constants';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { Client } from '../../common/decorators/client.decorator';
import { ClientEnum } from '../../common/enums/platform.enum';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('AUTH/CONTROLLER');
  constructor(
    private readonly userUseCases: UserUseCases,
    private readonly keyServerUseCases: KeyServerUseCases,
    private readonly cryptoService: CryptoService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly authUseCases: AuthUsecases,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get security details to log in',
  })
  @ApiOkResponse({ description: 'Retrieve details', type: LoginResponseDto })
  @Public()
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
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

  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @Post('/login/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access user account',
  })
  @ApiOkResponse({
    description: 'User  successfully accessed their account',
    type: LoginAccessResponseDto,
  })
  @Public()
  @WorkspaceLogAction(WorkspaceLogType.Login)
  async loginAccess(
    @Body() body: LoginAccessDto,
  ): Promise<LoginAccessResponseDto> {
    Logger.log(`[AUTH/LOGIN-ACCESS] Attempting login for email: ${body.email}`);
    try {
      const { ecc, kyber } = this.keyServerUseCases.parseKeysInput(body.keys, {
        privateKey: body.privateKey,
        publicKey: body.publicKey,
        revocationKey: body.revocateKey,
      });

      const result = await this.userUseCases.loginAccess({
        ...body,
        keys: { kyber, ecc },
      });

      Logger.log(
        `[AUTH/LOGIN-ACCESS] Successful login for email: ${body.email}`,
      );
      return result;
    } catch (error) {
      Logger.error(
        `[AUTH/LOGIN-ACCESS] Failed login attempt for email: ${body.email}`,
        error.stack,
      );
      throw error;
    }
  }

  @Throttle({ short: { ttl: seconds(60), limit: 5 } })
  @Get('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out of the account',
  })
  @ApiOkResponse({ description: 'Successfully logged out' })
  @WorkspaceLogAction(WorkspaceLogType.Logout)
  async logout(@JwtToken() jwt: string) {
    await this.authUseCases.logout(jwt);

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
  @AuditLog({ action: AuditAction.TfaEnabled })
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
  @AuditLog({ action: AuditAction.TfaDisabled })
  async deleteTfa(
    @UserDecorator() user: User,
    @Body() deleteTfaDto: DeleteTfaDto,
  ) {
    if (!deleteTfaDto.pass && !deleteTfaDto.code) {
      throw new BadRequestException(
        'At least one of password or TFA code must be provided',
      );
    }

    if (!user.secret_2FA) {
      throw new NotFoundException('Your account does not have 2FA activated.');
    }

    if (deleteTfaDto.code) {
      this.twoFactorAuthService.validateTwoFactorAuthCode(
        user.secret_2FA,
        deleteTfaDto.code,
      );
    }

    if (deleteTfaDto.pass) {
      const decryptedPass = this.cryptoService.decryptText(deleteTfaDto.pass);

      if (user.password.toString() !== decryptedPass) {
        throw new BadRequestException('Invalid password');
      }
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

  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @Post('/cli/login/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'CLI/Rclone platform login access',
  })
  @ApiOkResponse({
    description: 'User successfully accessed their account via CLI or Rclone',
    type: LoginAccessResponseDto,
  })
  @ApiPaymentRequiredResponse({
    description: 'This user current tier does not allow CLI/Rclone access',
  })
  @Public()
  async cliLoginAccess(
    @Body() body: LoginAccessDto,
    @Client() client: string,
  ): Promise<LoginAccessResponseDto> {
    let platform = ClientToPlatformMap[client as ClientEnum];

    if (!platform) {
      platform = PlatformName.RCLONE;
    }

    this.logger.log(
      { email: body.email, category: 'CLI-LOGIN-ACCESS', client, platform },
      'Attempting platform login',
    );
    try {
      const { ecc, kyber } = this.keyServerUseCases.parseKeysInput(body.keys, {
        privateKey: body.privateKey,
        publicKey: body.publicKey,
        revocationKey: body.revocateKey,
      });

      const result = await this.userUseCases.loginAccess({
        ...body,
        keys: { kyber, ecc },
        platform,
      });

      const canUserAccess =
        await this.featureLimitService.canUserAccessPlatform(
          platform,
          result.user.uuid,
        );

      if (!canUserAccess)
        throw new PaymentRequiredException(
          `${platform} access not allowed for this user tier`,
        );

      this.logger.log(
        { email: body.email, category: 'CLI-LOGIN-ACCESS', platform },
        'Successful platform login',
      );
      return result;
    } catch (error) {
      this.logger.error(
        { email: body.email, category: 'CLI-LOGIN-ACCESS', client, error },
        'Failed platform login attempt',
      );
      throw error;
    }
  }
}
