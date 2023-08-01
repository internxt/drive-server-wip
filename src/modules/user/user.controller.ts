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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { Response, Request } from 'express';
import { SignUpSuccessEvent } from '../../externals/notifications/events/sign-up-success.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import { User } from './user.domain';
import {
  InvalidReferralCodeError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  RecoverAccountDto,
  RequestRecoverAccountDto,
} from './dto/recover-account.dto';
import { verifyToken } from '../../lib/jwt';
import getEnv from '../../config/configuration';
import { validate } from 'uuid';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(
    private userUseCases: UserUseCases,
    private readonly notificationsService: NotificationService,
    private readonly keyServerUseCases: KeyServerUseCases,
  ) {}

  @UseGuards(ThrottlerGuard)
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
    try {
      const response = await this.userUseCases.createUser(createUserDto);
      const keys = await this.keyServerUseCases.addKeysToUser(
        response.user.id,
        createUserDto,
      );

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

    return {
      user: await this.userUseCases.getUser(user.uuid),
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
  @Put('/recover-account')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recover account',
  })
  @Public()
  async recoverAccount(
    @Query('token') token: string,
    @Body() body: RecoverAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { mnemonic, password, salt, privateKey } = body;
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

    const userUuid = decodedContent.payload.uuid;

    try {
      await this.userUseCases.updateCredentials(userUuid, {
        mnemonic,
        password,
        salt,
        privateKey,
      });
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
}
