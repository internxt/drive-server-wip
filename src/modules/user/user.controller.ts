import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  Logger,
  HttpStatus,
  Req,
  Get,
  Param,
  ForbiddenException,
  NotFoundException,
  UseGuards,
  Patch,
  Put,
  UploadedFile,
  Delete,
  Query,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  UseInterceptors,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPaymentRequiredResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { Response, Request } from 'express';
import { SignUpSuccessEvent } from '../../externals/notifications/events/sign-up-success.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import { AccountTokenAction, User } from './user.domain';
import {
  InvalidReferralCodeError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  RecoverAccountDto,
  RecoverAccountQueryDto,
  RequestRecoverAccountDto,
  DeprecatedRecoverAccountDto,
} from './dto/recover-account.dto';
import { LegacyRecoverAccountDto } from './dto/legacy-recover-account.dto';
import {
  generateJitsiJWT,
  verifyToken,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import getEnv from '../../config/configuration';
import { v4, validate } from 'uuid';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { PreCreateUserDto } from './dto/pre-create-user.dto';
import { RegisterPreCreatedUserDto } from './dto/register-pre-created-user.dto';
import { SharingService } from '../sharing/sharing.service';
import { CreateAttemptChangeEmailDto } from './dto/create-attempt-change-email.dto';
import { RequestAccountUnblock } from './dto/account-unblock.dto';
import { RegisterNotificationTokenDto } from './dto/register-notification-token.dto';
import { getFutureIAT } from '../../middlewares/passport';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogType } from '../workspaces/attributes/workspace-logs.attributes';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuditLog } from '../../common/audit-logs/decorators/audit-log.decorator';
import {
  AuditAction,
  AuditEntityType,
  AuditPerformerType,
} from '../../common/audit-logs/audit-logs.attributes';
import { AuditLogService } from '../../common/audit-logs/audit-log.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { avatarStorageS3Config } from '../../externals/multer';
import { Client } from '../../common/decorators/client.decorator';
import { DeactivationRequestEvent } from '../../externals/notifications/events/deactivation-request.event';
import { ConfirmAccountDeactivationDto } from './dto/confirm-deactivation.dto';
import { GetUserUsageDto } from './dto/responses/get-user-usage.dto';
import {
  RefreshUserCredentialsDto,
  RefreshUserTokensDto,
} from './dto/responses/user-credentials.dto';
import { GetUserLimitDto } from './dto/responses/get-user-limit.dto';
import { GetUploadStatusDto } from './dto/responses/get-upload-status.dto';
import { GenerateMnemonicResponseDto } from './dto/responses/generate-mnemonic.dto';
import { ClientEnum } from '../../common/enums/platform.enum';
import { JWT_7DAYS_EXPIRATION } from '../auth/constants';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { RefreshUserAvatarDto } from './dto/responses/refresh-avatar.dto';
import { GetOrCreatePublicKeysDto } from './dto/responses/get-or-create-publickeys.dto';
import { TimingConsistency } from '../auth/decorators/timing-consistency.decorator';
import { TimingConsistencyInterceptor } from '../auth/interceptors/timing-consistency.interceptor';
import { PlatformName } from '../../common/constants';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { KlaviyoTrackingService } from '../../externals/klaviyo/klaviyo-tracking.service';
import { CaptchaGuard } from '../auth/captcha.guard';

@ApiTags('User')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userUseCases: UserUseCases,
    private readonly notificationsService: NotificationService,
    private readonly keyServerUseCases: KeyServerUseCases,
    private readonly cryptoService: CryptoService,
    private readonly sharingService: SharingService,
    private readonly auditLogService: AuditLogService,
    private readonly featureLimitService: FeatureLimitService,
    private readonly klaviyoService: KlaviyoTrackingService,
  ) {}

  @Post('/')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a user',
  })
  @ApiOkResponse({ description: 'Creates a user' })
  @ApiBadRequestResponse({ description: 'Missing required fields' })
  @Public()
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Req() req: Request,
    @Client() clientId: string,
  ) {
    const isDriveWeb = clientId === ClientEnum.Web;

    try {
      const response = await this.userUseCases.createUser(createUserDto);

      const { ecc, kyber } = this.keyServerUseCases.parseKeysInput(
        createUserDto.keys,
        {
          privateKey: createUserDto.privateKey,
          publicKey: createUserDto.publicKey,
          revocationKey: createUserDto.revocationKey,
        },
      );

      const keys = await this.keyServerUseCases.addKeysToUser(
        response.user.id,
        {
          kyber,
          ecc,
        },
      );

      if (keys.ecc?.publicKey && keys.ecc?.privateKey) {
        await this.userUseCases.replacePreCreatedUser(
          response.user.email,
          response.user.uuid,
          keys.ecc.publicKey,
          keys.kyber?.publicKey,
        );
      }

      this.notificationsService.add(new SignUpSuccessEvent(response.user, req));

      // TODO: Move to EventBus
      this.userUseCases
        .sendWelcomeVerifyEmailEmail(createUserDto.email, {
          userUuid: response.uuid,
        })
        .catch((err) => {
          this.logger.error(
            `[AUTH/REGISTER/SENDWELCOMEEMAIL] ERROR: ${
              (err as Error).message
            }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
              (err as Error).stack
            }`,
          );
        });

      return {
        ...response,
        user: {
          ...response.user,
          root_folder_id: response.user.rootFolderId,
          ...(isDriveWeb
            ? { rootFolderId: response.user.rootFolderUuid }
            : null),
          publicKey: keys.ecc?.publicKey,
          privateKey: keys.ecc?.privateKey,
          revocationKey: keys.ecc?.revocationKey,
          keys: { ...keys },
        },
        token: response.token,
        newToken: response.newToken,
        uuid: response.uuid,
      };
    } catch (err) {
      if (err instanceof InvalidReferralCodeError) {
        throw new BadRequestException(err.message);
      } else if (err instanceof UserAlreadyRegisteredError) {
        throw new ConflictException(err.message);
      }

      this.logger.error(
        `[AUTH/REGISTER] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
          (err as Error).stack
        }`,
      );

      throw new InternalServerErrorException();
    }
  }

  @Get('/user/:email')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Get the user data by email and check if the user has subscription',
  })
  @ApiOkResponse({
    description: 'Get the user data by email',
  })
  @ApiBadRequestResponse({ description: 'Missing required fields' })
  @ApiParam({
    name: 'email',
    type: String,
  })
  async getUserByEmail(
    @Param('email') email: User['email'],
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = await this.userUseCases.getUserByUsername(email);
      if (!user) {
        throw new NotFoundException();
      }

      const userHasSubscriptions =
        await this.userUseCases.hasUserBeenSubscribedAnyTime(
          user.email,
          user.bridgeUser,
          user.userId,
        );

      return res
        .status(200)
        .json({ user: user, hasSubscriptions: userHasSubscriptions });
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND);
      } else {
        this.logger.error(
          `[AUTH/GET-USER-BY-EMAIL] ERROR: ${(err as Error).message}, STACK: ${
            (err as Error).stack
          }`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @UseGuards(CaptchaGuard)
  @Post('/pre-created-users/register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register Pre Created User',
  })
  @ApiOkResponse({ description: 'Creates Pre Created User' })
  @ApiBadRequestResponse({ description: 'Missing required fields' })
  @Public()
  async registerPreCreatedUser(
    @Body() bodyDto: RegisterPreCreatedUserDto,
    @Req() req: Request,
  ) {
    const { invitationId, ...createUserDto } = bodyDto;
    const email = createUserDto.email.toLowerCase();

    try {
      const preCreatedUser =
        await this.userUseCases.findPreCreatedByEmail(email);

      if (!preCreatedUser) {
        throw new NotFoundException('PRE_CREATED_USER_NOT_FOUND');
      }

      const userCreated = await this.userUseCases.createUser(createUserDto);

      const { ecc, kyber } = this.keyServerUseCases.parseKeysInput(
        createUserDto.keys,
        {
          privateKey: createUserDto.privateKey,
          publicKey: createUserDto.publicKey,
          revocationKey: createUserDto.revocationKey,
        },
      );

      const keys = await this.keyServerUseCases.addKeysToUser(
        userCreated.user.id,
        {
          kyber,
          ecc,
        },
      );

      if (keys.ecc?.publicKey && keys.ecc?.privateKey) {
        await this.userUseCases.replacePreCreatedUser(
          userCreated.user.email,
          userCreated.user.uuid,
          keys.ecc.publicKey,
          keys.kyber?.publicKey,
        );
      }

      this.notificationsService.add(
        new SignUpSuccessEvent(userCreated.user, req),
      );

      // TODO: Move to EventBus
      this.userUseCases
        .sendWelcomeVerifyEmailEmail(createUserDto.email, {
          userUuid: userCreated.uuid,
        })
        .catch((err) => {
          this.logger.error(
            `[AUTH/REGISTER/SENDWELCOMEEMAIL] ERROR: ${
              (err as Error).message
            }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
              (err as Error).stack
            }`,
          );
        });

      await this.sharingService
        .acceptInvite(userCreated.user, invitationId, {})
        .catch((err) => {
          this.logger.error(
            `[AUTH/REGISTER-PRE-CREATED-USER/AUTO-ACCEPT-INVITE] ERROR: ${
              (err as Error).message
            }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
              (err as Error).stack
            }`,
          );
        });

      return {
        ...userCreated,
        user: {
          ...userCreated.user,
          root_folder_id: userCreated.user.rootFolderId,
          publicKey: keys.ecc?.publicKey,
          privateKey: keys.ecc?.privateKey,
          revocationKey: keys.ecc?.revocationKey,
          keys: { ...keys },
        },
        token: userCreated.token,
        newToken: userCreated.newToken,
        uuid: userCreated.uuid,
      };
    } catch (err) {
      const errorMessage = err.message;

      if (err instanceof InvalidReferralCodeError) {
        throw new BadRequestException(errorMessage);
      } else if (err instanceof UserAlreadyRegisteredError) {
        throw new ConflictException(errorMessage);
      } else if (err instanceof NotFoundException) {
        throw new NotFoundException(errorMessage);
      }

      this.logger.error(
        `[AUTH/REGISTER-PRE-CREATED-USER] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...createUserDto,
          invitationId,
        })}, STACK: ${(err as Error).stack}`,
      );
      throw err;
    }
  }

  @Post('/pre-create')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pre create a user',
  })
  @ApiOkResponse({ description: 'Pre creates a user' })
  @ApiBadRequestResponse({ description: 'Missing required fields' })
  async preCreateUser(@Body() createUserDto: PreCreateUserDto) {
    const [user] = await this.userUseCases.preCreateUser(createUserDto);

    return {
      user: {
        email: user.email,
        uuid: user.uuid,
      },
      keys: {
        ecc: user.publicKey,
        kyber: user.publicKyberKey,
      },
      publicKey: user.publicKey,
    };
  }

  @Get('/c/:uuid')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get user credentials',
    deprecated: true,
  })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
    type: RefreshUserCredentialsDto,
  })
  async getUserCredentials(
    @UserDecorator() user: User,
    @Param('uuid') uuid: string,
  ): Promise<RefreshUserCredentialsDto> {
    if (uuid !== user.uuid) {
      throw new ForbiddenException();
    }

    const userCredentials = await this.userUseCases.getUserCredentials(user);
    return userCredentials;
  }

  @Get('/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh session token' })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
    type: RefreshUserTokensDto,
  })
  async refreshToken(
    @UserDecorator() user: User,
  ): Promise<RefreshUserTokensDto> {
    const userCredentials = await this.userUseCases.getUserCredentials(
      user,
      JWT_7DAYS_EXPIRATION,
    );
    return userCredentials;
  }

  @Get('/cli/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'CLI platform refresh session token',
  })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
    type: RefreshUserTokensDto,
  })
  @ApiPaymentRequiredResponse({
    description: 'This user current tier does not allow CLI access',
  })
  async cliRefresh(@UserDecorator() user: User): Promise<RefreshUserTokensDto> {
    this.logger.log(
      { email: user.email, category: 'CLI-USER-REFRESH' },
      'Attempting CLI user refresh',
    );
    try {
      const canUserAccess =
        await this.featureLimitService.canUserAccessPlatform(
          PlatformName.CLI,
          user.uuid,
        );

      if (!canUserAccess) {
        throw new PaymentRequiredException(
          'CLI access not allowed for this user tier',
        );
      }

      const userCredentials = await this.userUseCases.getUserCredentials(
        user,
        JWT_7DAYS_EXPIRATION,
      );

      this.logger.log(
        { email: user.email, category: 'CLI-USER-REFRESH' },
        'Successful CLI user refresh',
      );

      return userCredentials;
    } catch (error) {
      this.logger.error(
        { email: user.email, category: 'CLI-USER-REFRESH', error },
        'Failed CLI user refresh attempt',
      );
      throw error;
    }
  }

  @Get('/avatar/refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh avatar token',
  })
  @ApiOkResponse({
    description: 'Returns a new avatar URL',
    type: RefreshUserAvatarDto,
  })
  async refreshAvatarUser(
    @UserDecorator() user: User,
  ): Promise<RefreshUserAvatarDto> {
    const avatar = await this.userUseCases.getCachedAvatar(user);
    return { avatar };
  }

  @Patch('password')
  @ApiBearerAuth()
  @WorkspaceLogAction(WorkspaceLogType.ChangedPassword)
  @AuditLog({ action: AuditAction.PasswordChanged })
  async updatePassword(
    @Body() updatePasswordDto: UpdatePasswordDto,
    @UserDecorator() user: User,
    @Client() clientId: string,
  ) {
    const isDriveWeb = clientId === ClientEnum.Web;

    if (!isDriveWeb) {
      throw new BadRequestException(
        'Change password is only allowed from the web app',
      );
    }

    try {
      const currentPassword = this.cryptoService.decryptText(
        updatePasswordDto.currentPassword,
      );
      const newPassword = this.cryptoService.decryptText(
        updatePasswordDto.newPassword,
      );
      const newSalt = this.cryptoService.decryptText(updatePasswordDto.newSalt);

      const { mnemonic, encryptVersion } = updatePasswordDto;

      if (user.password.toString() !== currentPassword) {
        throw new UnauthorizedException();
      }

      await this.userUseCases.updatePassword(user, {
        currentPassword,
        newPassword,
        newSalt,
        mnemonic,
        privateKey: updatePasswordDto.privateKey,
        encryptVersion,
        privateKyberKey: updatePasswordDto?.privateKyberKey,
      });

      const { token, newToken } = await this.userUseCases.getAuthTokens(
        user,
        getFutureIAT(),
      );

      return { status: 'success', newToken, token };
    } catch (err) {
      Logger.error(
        `[AUTH/UPDATEPASSWORD] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify(updatePasswordDto)}, STACK: ${
          (err as Error).stack
        }`,
      );
      throw err;
    }
  }

  @UseGuards(CaptchaGuard)
  @Post('/recover-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request account recovery',
  })
  @Public()
  async requestAccountRecovery(@Body() body: RequestRecoverAccountDto) {
    try {
      await this.userUseCases.sendAccountRecoveryEmail(
        body.email.toLowerCase(),
      );
      this.logger.log(
        '[RECOVER_ACCOUNT_REQUEST] Account recovery email sent to: ' +
          body.email,
      );
    } catch (err) {
      this.logger.error(
        `[RECOVER_ACCOUNT_REQUEST] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { email: body.email },
        })}, STACK: ${(err as Error).stack}`,
      );

      throw err;
    }
  }

  @UseGuards(CaptchaGuard)
  @Post('/unblock-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request account unblock',
  })
  @Public()
  async requestAccountUnblock(@Body() body: RequestAccountUnblock) {
    try {
      const response = await this.userUseCases.sendAccountUnblockEmail(
        body.email,
      );
      return response;
    } catch (err) {
      if (!(err instanceof HttpException)) {
        this.logger.error(
          `[UNBLOCK_ACCOUNT_REQUEST] ERROR: ${
            (err as Error).message
          }, BODY ${JSON.stringify({
            ...body,
            user: { email: body.email },
          })}, STACK: ${(err as Error).stack}`,
        );
      }

      throw err;
    }
  }

  @Put('/unblock-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resets user error login counter to unblock account',
  })
  @Public()
  async accountUnblock(@Body('token') token: string) {
    let decodedContent: {
      payload: { uuid: string; action: string; email: string };
      iat: number;
    };
    try {
      const decoded = verifyWithDefaultSecret(token);
      if (typeof decoded === 'string') {
        throw new ForbiddenException();
      }
      decodedContent = decoded as {
        payload: { uuid: string; action: string; email: string };
        iat: number;
      };
    } catch {
      throw new ForbiddenException();
    }

    const tokenPayload = decodedContent?.payload;
    const tokenIat = decodedContent.iat;

    if (
      !tokenIat ||
      !tokenPayload.action ||
      !tokenPayload.uuid ||
      !tokenPayload.email ||
      tokenPayload.action !== AccountTokenAction.Unblock ||
      !validate(tokenPayload.uuid)
    ) {
      throw new ForbiddenException();
    }

    const { uuid, email } = tokenPayload;

    try {
      await this.userUseCases.unblockAccount(uuid, tokenIat);
    } catch (err) {
      if (
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }

      this.logger.error(
        `[UNBLOCK_ACCOUNT] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          user: { email, uuid },
        })}, STACK: ${(err as Error).stack}`,
      );

      throw new InternalServerErrorException();
    }
  }

  @Put('/recover-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recover account',
    deprecated: true,
  })
  @Public()
  async recoverAccount(
    @Query() query: RecoverAccountQueryDto,
    @Body() body: DeprecatedRecoverAccountDto,
  ) {
    const { token, reset } = query;
    const { mnemonic, password, salt } = body;
    let decodedContent: { payload?: { uuid?: string; action?: string } };

    try {
      const decoded = verifyToken(token, getEnv().secrets.jwt);

      if (typeof decoded === 'string') {
        throw new ForbiddenException();
      }

      decodedContent = decoded as {
        payload?: { uuid?: string; action?: string };
      };
    } catch (err) {
      throw new ForbiddenException();
    }

    if (
      !decodedContent.payload?.action ||
      !decodedContent.payload?.uuid ||
      decodedContent.payload.action !== 'recover-account' ||
      !validate(decodedContent.payload.uuid)
    ) {
      throw new ForbiddenException();
    }

    if (reset && reset !== 'true' && reset !== 'false') {
      throw new BadRequestException('Invalid value for parameter "reset"');
    }
    const shouldResetAccount = reset === 'true';

    const userUuid = decodedContent.payload.uuid;

    try {
      if (shouldResetAccount) {
        await this.userUseCases.updateCredentialsOld(
          userUuid,
          {
            mnemonic,
            password,
            salt,
          },
          true,
        );
      } else {
        const deprecatedRecoverAccountDto = body;

        await this.userUseCases.updateCredentialsOld(userUuid, {
          mnemonic,
          password,
          salt,
          privateKey: deprecatedRecoverAccountDto.privateKey,
        });
      }

      await this.auditLogService.log({
        entityType: AuditEntityType.User,
        entityId: userUuid,
        action: shouldResetAccount
          ? AuditAction.AccountReset
          : AuditAction.AccountRecovery,
        performerType: AuditPerformerType.User,
        performerId: userUuid,
      });
    } catch (err) {
      this.logger.error(
        `[RECOVER_ACCOUNT] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { uuid: userUuid },
        })}, STACK: ${(err as Error).stack}`,
      );
      throw err;
    }
  }

  @Put('/recover-account-v2')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recover account',
  })
  @Public()
  async recoverAccountV2(
    @Query() query: RecoverAccountQueryDto,
    @Body() body: RecoverAccountDto,
  ) {
    const { token, reset } = query;
    const { mnemonic, password, salt } = body;
    let decodedContent: { payload?: { uuid?: string; action?: string } };

    try {
      const decoded = verifyToken(token, getEnv().secrets.jwt);

      if (typeof decoded === 'string') {
        throw new ForbiddenException();
      }

      decodedContent = decoded as {
        payload?: { uuid?: string; action?: string };
      };

      if (
        !decodedContent.payload?.action ||
        !decodedContent.payload.uuid ||
        decodedContent.payload.action !== 'recover-account' ||
        !validate(decodedContent.payload.uuid)
      ) {
        throw new ForbiddenException();
      }
    } catch (err) {
      throw new ForbiddenException();
    }

    const userUuid = decodedContent.payload.uuid;
    const shouldResetAccount = reset === 'true';
    const invalidRecoverInput = !shouldResetAccount && !body.privateKeys;

    if (invalidRecoverInput) {
      throw new BadRequestException(
        'You must provide private keys if you want to recover account without resetting',
      );
    }

    const uuidsMatch = decodedContent.payload.uuid === body.uuid;
    if (body.uuid && !uuidsMatch) {
      throw new BadRequestException(
        'Backup file does not match the users uuid',
      );
    }

    try {
      this.logger.log(
        `[RECOVER_ACCOUNT] Recovering account for user: ${userUuid}`,
      );

      await this.userUseCases.updateCredentials(
        userUuid,
        {
          mnemonic,
          password,
          salt,
          ...(shouldResetAccount
            ? undefined
            : { privateKeys: body.privateKeys }),
        },
        shouldResetAccount,
      );

      this.logger.log(
        `[RECOVER_ACCOUNT] Account recovered successfully for user: ${userUuid}`,
      );

      await this.auditLogService.log({
        entityType: AuditEntityType.User,
        entityId: userUuid,
        action: shouldResetAccount
          ? AuditAction.AccountReset
          : AuditAction.AccountRecovery,
        performerType: AuditPerformerType.User,
        performerId: userUuid,
      });
    } catch (err) {
      this.logger.error(
        `[RECOVER_ACCOUNT] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { uuid: userUuid },
        })}, STACK: ${(err as Error).stack}`,
      );
      throw err;
    }
  }

  @Put('/legacy-recover-account')
  @Public()
  @ApiOperation({
    description:
      'Recover account with legacy backup file, mnemonic only files should be used',
    summary: 'Recover accocunt with legacy backup file',
  })
  async requestLegacyAccountRecovery(@Body() body: LegacyRecoverAccountDto) {
    Logger.log(
      `[RECOVER_ACCOUNT] Requesting legacy account recovery with token: ${body.token}`,
    );
    const { token } = body;

    const decodedToken =
      this.userUseCases.verifyAndDecodeAccountRecoveryToken(token);

    const { userUuid } = decodedToken;

    this.logger.log(
      `[RECOVER_ACCOUNT] Recovering account with legacy backup file for user: ${userUuid}`,
    );

    await this.userUseCases.recoverAccountLegacy(decodedToken.userUuid, body);

    this.logger.log(
      `[RECOVER_ACCOUNT] Account recovered with legacy backup file for user: ${userUuid}`,
    );
  }

  @Get('/public-key/:email')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get public key by email',
    deprecated: true,
  })
  @ApiParam({
    name: 'email',
    type: String,
  })
  async getPublicKeyByEmail(@Param('email') email: User['email']) {
    const user = await this.userUseCases.getUserByUsername(email.toLowerCase());

    if (!user) {
      throw new NotFoundException();
    }

    const keys = await this.keyServerUseCases.getPublicKeys(user.id);

    return { publicKey: keys.ecc, keys };
  }

  @Put('/public-key/:email')
  @UseGuards(CaptchaGuard)
  @UseInterceptors(TimingConsistencyInterceptor)
  @TimingConsistency({ minimumResponseTimeMs: 900 })
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Retieve public key (existing users) or pre-create user and retrieve key',
  })
  @ApiOkResponse({
    description: 'Returns a public key',
    type: GetOrCreatePublicKeysDto,
  })
  @ApiParam({
    name: 'email',
    type: String,
  })
  async getOrPreCreatePublicKeyByEmail(
    @Param('email') email: User['email'],
    @UserDecorator() requestingUser: User,
  ): Promise<GetOrCreatePublicKeysDto> {
    return this.userUseCases.getOrPreCreateUser(
      email.toLowerCase(),
      requestingUser,
    );
  }

  @HttpCode(201)
  @UseGuards(CaptchaGuard)
  @Post('/attempt-change-email')
  async createAttemptChangeEmail(
    @UserDecorator() user: User,
    @Body() body: CreateAttemptChangeEmailDto,
  ) {
    await this.userUseCases.createAttemptChangeEmail(
      user,
      body.newEmail.toLowerCase(),
    );
  }

  @HttpCode(201)
  @Post('/attempt-change-email/:encryptedAttemptChangeEmailId/accept')
  @AuditLog({
    action: AuditAction.EmailChanged,
    metadata: (_req, res) => ({
      oldEmail: res.newEmail,
      newEmail: res.oldEmail,
    }),
  })
  async acceptAttemptChangeEmail(
    @Param('encryptedAttemptChangeEmailId') id: string,
  ) {
    const result = await this.userUseCases.acceptAttemptChangeEmail(id);

    this.logger.log(
      `[EMAIL_CHANGE] Email changed for user: ${result.newAuthentication.user.uuid}, oldEmail: ${result.oldEmail}, newEmail: ${result.newEmail}`,
    );

    return result;
  }

  @HttpCode(200)
  @Get('/attempt-change-email/:encryptedAttemptChangeEmailId/verify-expiration')
  async verifyAttemptChangeEmail(
    @Param('encryptedAttemptChangeEmailId') id: string,
  ) {
    return await this.userUseCases.isAttemptChangeEmailExpired(id);
  }

  @Get('/meet-token/beta')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get the user Meet token',
  })
  @ApiOkResponse({
    description: 'Returns a new meet token related to the beta user',
  })
  async getMeetTokenBeta(
    @UserDecorator() user: User,
    @Query('room') room: string,
  ) {
    const closedBetaEmails: string[] =
      await this.userUseCases.getMeetClosedBetaUsers();
    if (closedBetaEmails.includes(user.email.trim().toLowerCase())) {
      let token: string;

      if (!room || !validate(room)) {
        const newRoom = v4();
        token = generateJitsiJWT(user, newRoom, true);
        await this.userUseCases.setRoomToBetaUser(newRoom, user);
        return { token, room: newRoom };
      } else {
        const roomCreator = await this.userUseCases.getBetaUserFromRoom(room);
        if (roomCreator && roomCreator.uuid === user.uuid) {
          token = generateJitsiJWT(user, room, true);
        } else {
          token = generateJitsiJWT(user, room, false);
        }
        return { token, room };
      }
    } else {
      throw new UnauthorizedException(
        'User can not interact with Internxt Meet Beta',
      );
    }
  }

  @Get('/meet-token/anon')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get an anonymous user Meet token',
  })
  @ApiOkResponse({
    description: 'Returns a new meet anonymous token',
  })
  @Public()
  async getMeetTokenAnon(@Query('room') room: string) {
    const roomCreator = await this.userUseCases.getBetaUserFromRoom(room);
    const isRoomCreated = roomCreator !== null;
    if (!room || !validate(room) || !isRoomCreated) {
      throw new ForbiddenException('Room is not valid');
    } else {
      const token = generateJitsiJWT(null, room, false);
      return { token };
    }
  }

  @Post('/notification-token')
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a notification token',
  })
  @ApiResponse({ status: 201, description: 'Creates a notification token' })
  async addNotificationToken(
    @UserDecorator() user: User,
    @Body() body: RegisterNotificationTokenDto,
  ) {
    return this.userUseCases.registerUserNotificationToken(user, body);
  }

  @Post('/email-verification/send')
  @UseGuards(CaptchaGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send account verification email',
  })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  async sendAccountVerifyEmail(@UserDecorator() user: User) {
    return this.userUseCases.sendAccountEmailVerification(user);
  }

  @Post('/email-verification')
  @ApiOperation({
    summary: 'Verify user email',
  })
  @ApiResponse({ status: 201, description: 'Email verified successfully' })
  @Public()
  async verifyAccountEmail(@Body() body: VerifyEmailDto) {
    return this.userUseCases.verifyUserEmail(body.verificationToken);
  }

  @Patch('/profile')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user profile',
  })
  @ApiOkResponse({
    description: 'Updated user profile',
  })
  async updateProfile(
    @UserDecorator() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    if (!updateProfileDto.name && updateProfileDto.lastname == undefined) {
      throw new BadRequestException(
        'At least one of name or lastname must be provided.',
      );
    }
    return this.userUseCases.updateProfile(user, updateProfileDto);
  }

  @Put('/avatar')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Avatar added to the user',
  })
  @UseInterceptors(FileInterceptor('avatar', avatarStorageS3Config))
  async uploadAvatar(
    @UploadedFile() avatar: Express.MulterS3.File,
    @UserDecorator() user: User,
  ) {
    if (!avatar) {
      throw new BadRequestException('avatar is required');
    }
    if (!avatar.key) {
      throw new InternalServerErrorException('Avatar could not be uploaded');
    }

    try {
      return await this.userUseCases.upsertAvatar(user, avatar.key);
    } catch (err) {
      Logger.error(
        `[USER/UPLOAD_AVATAR] Error uploading avatar for user: ${user.id}. Error: ${err.message}`,
      );
      throw err;
    }
  }

  @Delete('/avatar')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Avatar deleted from the workspace',
  })
  async deleteAvatar(@UserDecorator() user: User) {
    try {
      return await this.userUseCases.deleteAvatar(user);
    } catch (err) {
      Logger.error(
        `[USER/DELETE_AVATAR] Error deleting the avatar for the user: ${
          user.id
        } has failed. Error: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  @Post('/deactivation/send')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send email to deactivate current user account',
  })
  async sendUserDeactivationEmail(
    @UserDecorator() user: User,
    @Req() req: Request,
  ) {
    const response = await this.userUseCases.sendDeactivationEmail(user);

    this.notificationsService.add(new DeactivationRequestEvent(user, req));

    return response;
  }

  @Post('/deactivation/confirm')
  @ApiBearerAuth()
  @AuditLog({
    action: AuditAction.AccountDeactivated,
    metadata: (_req, res) => ({ email: res.deactivatedUser.email }),
  })
  @ApiOperation({
    summary: 'Confirm user deactivation',
  })
  async confirmUserDeactivation(@Body() body: ConfirmAccountDeactivationDto) {
    const { token } = body;
    this.logger.log(
      { token },
      '[DEACTIVATION] User account deactivation confirmation started',
    );

    try {
      const deactivatedUser =
        await this.userUseCases.confirmDeactivation(token);
      this.logger.log(
        `[DEACTIVATION] User account deactivated successfully for user: ${deactivatedUser.uuid}, email: ${deactivatedUser.email}`,
      );
      return { deactivatedUser };
    } catch (err) {
      this.logger.error(
        { err, token },
        `[DEACTIVATION] Error confirming deactivation`,
      );
      throw err;
    }
  }

  @Get('/usage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get User used storage space',
  })
  @ApiOkResponse({ type: GetUserUsageDto })
  async getUserUsage(@UserDecorator() user: User): Promise<GetUserUsageDto> {
    const usage = await this.userUseCases.getUserUsage(user);

    this.userUseCases
      .checkAndNotifyStorageThreshold(user, usage)
      .catch((error) => {
        new Logger('[STORAGE/THRESHOLD_CHECK]').error(
          `Failed to check storage threshold for user ${user.uuid}: ${error.message}`,
        );
      });

    return usage;
  }

  @Get('/limit')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Get user space limit',
    type: GetUserLimitDto,
  })
  async limit(@UserDecorator() user: User): Promise<GetUserLimitDto> {
    try {
      const maxSpaceBytes = await this.userUseCases.getSpaceLimit(user);
      return { maxSpaceBytes };
    } catch (err) {
      Logger.error(
        `[SPACE_LIMIT] Error getting space limit for user: ${
          user.id
        }. Error: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  @Get('/me/upload-status')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if user has uploaded any files',
  })
  @ApiOkResponse({
    description: 'Returns whether the user has uploaded any files',
    type: GetUploadStatusDto,
  })
  async getUploadStatus(
    @UserDecorator() user: User,
  ): Promise<GetUploadStatusDto> {
    const hasUploadedFiles = await this.userUseCases.hasUploadedFiles(user);
    return { hasUploadedFiles };
  }

  @Get('/generate-mnemonic')
  @Public()
  @ApiOkResponse({
    description: 'Returns a mnemonic, it is not saved anywhere',
    type: GenerateMnemonicResponseDto,
  })
  async generateMnemonic(): Promise<GenerateMnemonicResponseDto> {
    const mnemonic = await this.userUseCases.generateMnemonic();
    return { mnemonic };
  }
  @Post('/payments/incomplete-checkout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Handle incomplete checkout event',
    description: 'Sends notification email when user abandons checkout process',
  })
  @ApiResponse({
    status: 200,
    description: 'Incomplete checkout processed successfully',
  })
  async handleIncompleteCheckout(
    @UserDecorator() user: User,
    @Body() dto: IncompleteCheckoutDto,
  ) {
    try {
      await this.klaviyoService.trackCheckoutStarted(user.email, {
        checkoutUrl: dto.completeCheckoutUrl,
        planName: dto.planName,
        price: dto.price,
      });
    } catch (error) {
      Logger.error(
        `[KLAVIYO] Failed to track checkout for ${user.email}: ${error.message}`,
      );
    }
    return {
      success: true,
      message: 'Checkout event tracked successfully',
    };
  }
}
