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
import { ThrottlerGuard } from '../../guards/throttler.guard';
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
import { Throttle } from '@nestjs/throttler';
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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { avatarStorageS3Config } from '../../externals/multer';
import { Client } from '../auth/decorators/client.decorator';
import { DeactivationRequestEvent } from '../../externals/notifications/events/deactivation-request.event';
import { ConfirmAccountDeactivationDto } from './dto/confirm-deactivation.dto';
import { GetUserUsageDto } from './dto/responses/get-user-usage.dto';
import { RefreshTokenResponseDto } from './dto/responses/refresh-token.dto';
import { GetUserLimitDto } from './dto/responses/get-user-limit.dto';
import { GetUploadStatusDto } from './dto/responses/get-upload-status.dto';
import { GenerateMnemonicResponseDto } from './dto/responses/generate-mnemonic.dto';
import { ClientEnum } from '../../common/enums/platform.enum';
import { JWT_7DAYS_EXPIRATION } from '../auth/constants';

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
  ) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({
    long: {
      ttl: 3600,
      limit: 5,
    },
  })
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

  @UseGuards(ThrottlerGuard)
  @Throttle({
    long: {
      ttl: 3600,
      limit: 5,
    },
  })
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

  @UseGuards(ThrottlerGuard)
  @Throttle({
    long: {
      ttl: 3600,
      limit: 5,
    },
  })
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

    try {
      const preCreatedUser = await this.userUseCases.findPreCreatedByEmail(
        createUserDto.email,
      );

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
    const user = await this.userUseCases.preCreateUser(createUserDto);

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
  @ApiOperation({ summary: 'Get user credentials' })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
  })
  async getUserCredentials(
    @UserDecorator() user: User,
    @Param('uuid') uuid: string,
  ) {
    if (uuid !== user.uuid) {
      throw new ForbiddenException();
    }

    const { token, newToken } = await this.userUseCases.getAuthTokens(user);
    const avatar = await this.userUseCases.getAvatarUrl(user.avatar);

    return {
      user: { ...user, avatar },
      oldToken: token,
      newToken: newToken,
    };
  }

  @Get('/refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh session token',
  })
  @ApiOkResponse({
    description: 'Returns a new token',
    type: RefreshTokenResponseDto,
  })
  async refreshToken(
    @UserDecorator() user: User,
  ): Promise<RefreshTokenResponseDto> {
    const tokens = await this.userUseCases.getAuthTokens(
      user,
      undefined,
      JWT_7DAYS_EXPIRATION,
    );

    const [avatar, rootFolder] = await Promise.all([
      user.avatar ? this.userUseCases.getAvatarUrl(user.avatar) : null,
      this.userUseCases.getOrCreateUserRootFolderAndBucket(user),
    ]);

    const userData = {
      email: user.email,
      userId: user.userId,
      mnemonic: user.mnemonic.toString(),
      root_folder_id: rootFolder?.id,
      rootFolderId: rootFolder?.uuid,
      name: user.name,
      lastname: user.lastname,
      uuid: user.uuid,
      bucket: rootFolder?.bucket,
      credit: user.credit,
      createdAt: user.createdAt,
      registerCompleted: user.registerCompleted,
      teams: false,
      username: user.username,
      bridgeUser: user.bridgeUser,
      sharedWorkspace: user.sharedWorkspace,
      appSumoDetails: null,
      hasReferralsProgram: false,
      backupsBucket: user.backupsBucket,
      avatar,
      emailVerified: user.emailVerified,
      lastPasswordChangedAt: user.lastPasswordChangedAt,
    };

    return { ...tokens, user: userData };
  }

  @Patch('password')
  @ApiBearerAuth()
  @WorkspaceLogAction(WorkspaceLogType.ChangedPassword)
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
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

    const userUuid = decodedContent.payload.uuid;

    try {
      if (reset === 'true') {
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
  @Put('/legacy-recover-account')
  @Public()
  @ApiOperation({
    description:
      'Recover account with legacy backup file, mnemonic only files should be used',
    summary: 'Recover accocunt with legacy backup file',
  })
  async requestLegacyAccountRecovery(@Body() body: LegacyRecoverAccountDto) {
    const { token } = body;

    if (!token) {
      throw new BadRequestException('Token is required');
    }

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
  })
  @ApiParam({
    name: 'email',
    type: String,
  })
  async getPublicKeyByEmail(@Param('email') email: User['email']) {
    const user = await this.userUseCases.getUserByUsername(email);

    if (!user) {
      throw new NotFoundException();
    }

    const keys = await this.keyServerUseCases.getPublicKeys(user.id);

    return { publicKey: keys.ecc, keys };
  }

  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Post('/attempt-change-email')
  async createAttemptChangeEmail(
    @UserDecorator() user: User,
    @Body() body: CreateAttemptChangeEmailDto,
  ) {
    await this.userUseCases.createAttemptChangeEmail(user, body.newEmail);
  }

  @HttpCode(201)
  @Post('/attempt-change-email/:encryptedAttemptChangeEmailId/accept')
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
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

  @UseGuards(ThrottlerGuard)
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send account verification email',
  })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  async sendAccountVerifyEmail(@UserDecorator() user: User) {
    return this.userUseCases.sendAccountEmailVerification(user);
  }

  @Post('/email-verification')
  @UseGuards(ThrottlerGuard)
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
  @UseGuards(ThrottlerGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm user deactivation',
  })
  async confirmUserDeactivation(@Body() body: ConfirmAccountDeactivationDto) {
    const { token } = body;

    const deactivatedUser = await this.userUseCases.confirmDeactivation(token);

    this.logger.log(
      `[DEACTIVATION] User account deactivated successfully for user: ${deactivatedUser.uuid}, email: ${deactivatedUser.email}`,
    );
  }

  @Get('/usage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get User used storage space',
  })
  @ApiOkResponse({ type: GetUserUsageDto })
  async getUserUsage(@UserDecorator() user: User): Promise<GetUserUsageDto> {
    const usage = await this.userUseCases.getUserUsage(user);

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
  @Throttle({
    long: {
      ttl: 3600,
      limit: 5,
    },
  })
  @Public()
  @ApiOkResponse({
    description: 'Returns a mnemonic, it is not saved anywhere',
    type: GenerateMnemonicResponseDto,
  })
  async generateMnemonic(): Promise<GenerateMnemonicResponseDto> {
    const mnemonic = await this.userUseCases.generateMnemonic();
    return { mnemonic };
  }
}
