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
  Request as RequestDecorator,
  Put,
  Query,
  UnauthorizedException,
  BadRequestException,
  UseFilters,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
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
  KeyServerNotFoundError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '../../guards/throttler.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  RecoverAccountDto,
  RequestRecoverAccountDto,
  ResetAccountDto,
} from './dto/recover-account.dto';
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
import { HttpExceptionFilter } from '../../lib/http/http-exception.filter';
import { RequestAccountUnblock } from './dto/account-unblock.dto';
import { RegisterNotificationTokenDto } from './dto/register-notification-token.dto';
import { getFutureIAT } from '../../middlewares/passport';
import { WorkspaceLogAction } from '../workspaces/decorators/workspace-log-action.decorator';
import { WorkspaceLogType } from '../workspaces/attributes/workspace-logs.attributes';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(
    private userUseCases: UserUseCases,
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const isDriveWeb = req.headers['internxt-client'] === 'drive-web';

    try {
      const response = await this.userUseCases.createUser(createUserDto);
      const keys = await this.keyServerUseCases.addKeysToUser(
        response.user.id,
        createUserDto,
      );

      if (req.headers['internxt-client'] !== 'drive-mobile') {
        await this.userUseCases.replacePreCreatedUser(
          response.user.email,
          response.user.uuid,
          keys.publicKey,
        );
      }

      this.notificationsService.add(
        new SignUpSuccessEvent(response.user as unknown as User, req),
      );

      // TODO: Move to EventBus
      this.userUseCases
        .sendWelcomeVerifyEmailEmail(createUserDto.email, {
          userUuid: response.uuid,
        })
        .catch((err) => {
          new Logger().error(
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
          ...keys,
        },
        token: response.token,
        uuid: response.uuid,
      };
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof InvalidReferralCodeError) {
        res.status(HttpStatus.BAD_REQUEST);
      } else if (err instanceof UserAlreadyRegisteredError) {
        res.status(HttpStatus.CONFLICT);
      } else {
        new Logger().error(
          `[AUTH/REGISTER] ERROR: ${
            (err as Error).message
          }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
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
        new Logger().error(
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
    @Body() { invitationId, ...createUserDto }: RegisterPreCreatedUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const preCreatedUser = await this.userUseCases.findPreCreatedByEmail(
        createUserDto.email,
      );

      if (!preCreatedUser) {
        throw new NotFoundException('PRE_CREATED_USER_NOT_FOUND');
      }

      const userCreated = await this.userUseCases.createUser(createUserDto);

      const keys = await this.keyServerUseCases.addKeysToUser(
        userCreated.user.id,
        createUserDto,
      );

      await this.userUseCases.replacePreCreatedUser(
        userCreated.user.email,
        userCreated.user.uuid,
        keys.publicKey,
      );

      this.notificationsService.add(
        new SignUpSuccessEvent(userCreated.user as unknown as User, req),
      );

      // TODO: Move to EventBus
      this.userUseCases
        .sendWelcomeVerifyEmailEmail(createUserDto.email, {
          userUuid: userCreated.uuid,
        })
        .catch((err) => {
          new Logger().error(
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
          new Logger().error(
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
          ...keys,
        },
        token: userCreated.token,
        uuid: userCreated.uuid,
      };
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof InvalidReferralCodeError) {
        res.status(HttpStatus.BAD_REQUEST);
      } else if (err instanceof UserAlreadyRegisteredError) {
        res.status(HttpStatus.CONFLICT);
      } else if (err instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND);
      } else {
        new Logger().error(
          `[AUTH/REGISTER-PRE-CREATED-USER] ERROR: ${
            (err as Error).message
          }, BODY ${JSON.stringify({
            ...createUserDto,
            invitationId,
          })}, STACK: ${(err as Error).stack}`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @Post('/pre-create')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pre create a user',
  })
  @ApiOkResponse({ description: 'Pre creates a user' })
  @ApiBadRequestResponse({ description: 'Missing required fields' })
  async preCreateUser(
    @Body() createUserDto: PreCreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = await this.userUseCases.preCreateUser(createUserDto);

      return {
        user: {
          email: user.email,
          uuid: user.uuid,
        },
        publicKey: user.publicKey,
      };
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof UserAlreadyRegisteredError) {
        res.status(HttpStatus.CONFLICT);
      } else {
        new Logger().error(
          `[AUTH/PREREGISTER] ERROR: ${
            (err as Error).message
          }, BODY ${JSON.stringify(createUserDto)}, STACK: ${
            (err as Error).stack
          }`,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        errorMessage = 'Internal Server Error';
      }

      return { error: errorMessage };
    }
  }

  @Get('/c/:uuid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get user credentials' })
  @ApiOkResponse({
    description: 'Returns the user metadata and the authentication tokens',
  })
  async getUserCredentials(@Req() req, @Param('uuid') uuid: string) {
    if (uuid !== req.user.uuid) {
      throw new ForbiddenException();
    }
    const user = await this.userUseCases.getUser(uuid);

    if (!user) {
      throw new NotFoundException();
    }

    const { token, newToken } = this.userUseCases.getAuthTokens(user);
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
  @ApiOkResponse({ description: 'Returns a new token' })
  refreshToken(@UserDecorator() user: User) {
    return this.userUseCases.getAuthTokens(user);
  }

  @Patch('password')
  @ApiBearerAuth()
  @WorkspaceLogAction(WorkspaceLogType.ChangedPassword)
  async updatePassword(
    @RequestDecorator() req,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Res({ passthrough: true }) res: Response,
    @UserDecorator() user: User,
  ) {
    try {
      const currentPassword = this.cryptoService.decryptText(
        updatePasswordDto.currentPassword,
      );
      const newPassword = this.cryptoService.decryptText(
        updatePasswordDto.newPassword,
      );
      const newSalt = this.cryptoService.decryptText(updatePasswordDto.newSalt);

      const { mnemonic, privateKey, encryptVersion } = updatePasswordDto;

      if (user.password.toString() !== currentPassword) {
        throw new UnauthorizedException();
      }

      await this.userUseCases.updatePassword(req.user, {
        currentPassword,
        newPassword,
        newSalt,
        mnemonic,
        privateKey,
        encryptVersion,
      });

      const { token, newToken } = this.userUseCases.getAuthTokens(
        user,
        getFutureIAT(),
      );

      return { status: 'success', newToken, token };
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof UnauthorizedException) {
        res.status(HttpStatus.BAD_REQUEST);
      } else if (err instanceof KeyServerNotFoundError) {
        res.status(HttpStatus.NOT_FOUND);
      } else {
        new Logger().error(
          `[AUTH/UPDATEPASSWORD] ERROR: ${
            (err as Error).message
          }, BODY ${JSON.stringify(updatePasswordDto)}, STACK: ${
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
  @Post('/recover-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request account recovery',
  })
  @Public()
  async requestAccountRecovery(
    @Body() body: RequestRecoverAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.userUseCases.sendAccountRecoveryEmail(body.email);
    } catch (err) {
      new Logger().error(
        `[USERS/RECOVER_ACCOUNT_REQUEST] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { email: body.email },
        })}, STACK: ${(err as Error).stack}`,
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR);

      return { error: 'Internal Server Error' };
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
      if (err instanceof HttpException) {
        throw err;
      }

      new Logger().error(
        `[USERS/UNBLOCK_ACCOUNT_REQUEST] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { email: body.email },
        })}, STACK: ${(err as Error).stack}`,
      );

      throw new InternalServerErrorException();
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

      new Logger().error(
        `[USERS/UNBLOCK_ACCOUNT] ERROR: ${
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
  })
  @Public()
  async recoverAccount(
    @Query('token') token: string,
    @Query('reset') reset: string,
    @Body() body: RecoverAccountDto | ResetAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
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
      !decodedContent.payload ||
      !decodedContent.payload.action ||
      !decodedContent.payload.uuid ||
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
        await this.userUseCases.updateCredentials(
          userUuid,
          {
            mnemonic,
            password,
            salt,
          },
          true,
        );
      } else {
        const { privateKey } = body as RecoverAccountDto;

        await this.userUseCases.updateCredentials(userUuid, {
          mnemonic,
          password,
          salt,
          privateKey,
        });
      }
    } catch (err) {
      new Logger().error(
        `[USERS/RECOVER_ACCOUNT] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify({
          ...body,
          user: { uuid: userUuid },
        })}, STACK: ${(err as Error).stack}`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);

      return { error: 'Internal Server Error' };
    }
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

    return {
      publicKey: await this.keyServerUseCases.getPublicKey(user.id),
    };
  }

  @UseFilters(new HttpExceptionFilter())
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Post('/attempt-change-email')
  async createAttemptChangeEmail(
    @UserDecorator() user: User,
    @Body() body: CreateAttemptChangeEmailDto,
  ) {
    await this.userUseCases.createAttemptChangeEmail(user, body.newEmail);
  }

  @UseFilters(new HttpExceptionFilter())
  @HttpCode(201)
  @Post('/attempt-change-email/:encryptedAttemptChangeEmailId/accept')
  acceptAttemptChangeEmail(@Param('encryptedAttemptChangeEmailId') id: string) {
    return this.userUseCases.acceptAttemptChangeEmail(id);
  }

  @UseFilters(new HttpExceptionFilter())
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

  @Post('/verify-email')
  @ApiOperation({
    summary: 'Verify user email',
  })
  @ApiResponse({ status: 201, description: 'Email verified successfully' })
  @Public()
  async verifyAccountEmail(@Body() body: VerifyEmailDto) {
    return this.userUseCases.verifyUserEmail(body.verificationToken);
  }

  @Post('/send-verification-email')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send account verification email',
  })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  async sendAccountVerifyEmail(@UserDecorator() user: User) {
    return this.userUseCases.sendAccountEmailVerification(user);
  }
}
