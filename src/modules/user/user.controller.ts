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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { Response, Request } from 'express';
import { SignUpSuccessEvent } from '../../externals/notifications/events/sign-up-success.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import { User } from './user.domain';
import {
  InvalidPasswordError,
  InvalidReferralCodeError,
  KeyServerNotFoundError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UpdatePasswordDto } from './dto/update-password.dto';

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

  @Patch('password')
  @ApiBearerAuth()
  async updatePassword(
    @RequestDecorator() req,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.userUseCases.updatePassword(req.user, updatePasswordDto);
      return { status: 'success' };
    } catch (err) {
      let errorMessage = err.message;

      if (err instanceof InvalidPasswordError) {
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
}
