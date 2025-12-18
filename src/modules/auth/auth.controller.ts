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
import { ThrottlerGuard } from '../../guards/throttler.guard';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import {
  LoginAccessDto,
  LoginAccessOpaqueStartDto,
  LoginAccessOpaqueFinishDto,
} from './dto/login-access.dto';
import { User as UserDecorator } from './decorators/user.decorator';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogType } from '../workspaces/attributes/workspace-logs.attributes';
import { AreCredentialsCorrectDto } from './dto/are-credentials-correct.dto';
import { AuditLog } from '../../common/audit-logs/decorators/audit-log.decorator';
import { AuditAction } from '../../common/audit-logs/audit-logs.attributes';
import {
  LoginAccessResponseDto,
  LoginAccessResponseOpaqueFinishDto,
  LoginAccessResponseOpaqueStartDto,
} from './dto/responses/login-access-response.dto';
import { LoginResponseDto } from './dto/responses/login-response.dto';
import { JwtToken } from './decorators/get-jwt.decorator';
import { AuthUsecases } from './auth.usecase';
import { PlatformName } from '../../common/constants';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';

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
        useOpaqueLogin: user.isOpaqueEnabled ?? false,
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

  @Post('/login-opaque/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start opaque to access user account',
  })
  @ApiOkResponse({
    description: 'User successfully complited first stage of opaque login',
    type: LoginAccessResponseOpaqueStartDto,
  })
  @Public()
  @WorkspaceLogAction(WorkspaceLogType.LoginOpaqueStart)
  async loginOpaqueStart(
    @Body() body: LoginAccessOpaqueStartDto,
  ): Promise<LoginAccessResponseOpaqueStartDto> {
    Logger.log(
      `[AUTH/LOGIN-ACCESS-OPAQUE-START] Attempting first step of opaque login for email: ${body.email}`,
    );
    try {
      const email = body.email.toLowerCase();
      const user = await this.userUseCases.findByEmail(email);

      if (!user) {
        throw new UnauthorizedException('Wrong login credentials');
      }

      const { loginResponse, serverLoginState } =
        this.cryptoService.startLoginOpaque(
          email,
          user.registrationRecord,
          body.startLoginRequest,
        );

      await this.userUseCases.setLoginState(email, serverLoginState);

      Logger.log(
        `[AUTH/LOGIN-ACCESS-OPAQUE-START] Successful first step of opaque login for email: ${body.email}`,
      );
      return { loginResponse };
    } catch (error) {
      Logger.error(
        `[AUTH/LOGIN-ACCESS-OPAQUE-START] Failed first step of opaque login attempt for email: ${body.email}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('/login-opaque/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finish opaque to access user account',
  })
  @ApiOkResponse({
    description: 'User successfully complited first stage of opaque login',
    type: LoginAccessResponseOpaqueFinishDto,
  })
  @Public()
  @WorkspaceLogAction(WorkspaceLogType.LoginOpaqueFinish)
  async loginOpaqueFinish(
    @Body() body: LoginAccessOpaqueFinishDto,
  ): Promise<LoginAccessResponseOpaqueFinishDto> {
    Logger.log(
      `[AUTH/LOGIN-ACCESS-OPAQUE-FINISH] Attempting second step of opaque login for email: ${body.email}`,
    );
    try {
      const email = body.email.toLowerCase();
      const user = await this.userUseCases.findByEmail(email);

      if (!user) {
        throw new UnauthorizedException('Wrong login credentials');
      }

      const serverLoginState = await this.userUseCases.getLoginState(email);

      const { sessionKey } = this.cryptoService.finishLoginOpaque(
        body.finishLoginRequest,
        serverLoginState,
      );

      const sessionID = this.cryptoService.generateSessionID();
      await this.userUseCases.setSessionKey(sessionID, sessionKey);

      const { user: userDTO, token } =
        await this.userUseCases.loginAccessOpaque(email, body.tfa);

      Logger.log(
        `[AUTH/LOGIN-ACCESS-OPAQUE-FINISH] Successful second step of opaque login for email: ${body.email}`,
      );
      return { user: userDTO, sessionID, token };
    } catch (error) {
      Logger.error(
        `[AUTH/LOGIN-ACCESS-OPAQUE-START] Failed first step of opaque login attempt for email: ${body.email}`,
        error.stack,
      );
      throw error;
    }
  }

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

  @UseGuards(ThrottlerGuard)
  @Post('/cli/login/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'CLI platform login access',
  })
  @ApiOkResponse({
    description: 'CLI user successfully accessed their account',
    type: LoginAccessResponseDto,
  })
  @ApiPaymentRequiredResponse({
    description: 'This user current tier does not allow CLI access',
  })
  @Public()
  async cliLoginAccess(
    @Body() body: LoginAccessDto,
  ): Promise<LoginAccessResponseDto> {
    this.logger.log(
      { email: body.email, category: 'CLI-LOGIN-ACCESS' },
      'Attempting CLI login',
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
        platform: PlatformName.CLI,
      });

      const canUserAccess =
        await this.featureLimitService.canUserAccessPlatform(
          PlatformName.CLI,
          result.user.uuid,
        );

      if (!canUserAccess)
        throw new PaymentRequiredException(
          'CLI access not allowed for this user tier',
        );

      this.logger.log(
        { email: body.email, category: 'CLI-LOGIN-ACCESS' },
        'Successful CLI login',
      );
      return result;
    } catch (error) {
      this.logger.error(
        { email: body.email, category: 'CLI-LOGIN-ACCESS', error },
        'Failed CLI login attempt',
      );
      throw error;
    }
  }
}
