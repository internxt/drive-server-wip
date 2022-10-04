import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  Logger,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { Response, Request } from 'express';
import { SignUpEvent } from 'src/externals/notifications/events/sign-up.event';
import { NotificationService } from 'src/externals/notifications/notification.service';
import { UserAttributes } from './user.domain';
import {
  InvalidReferralCodeError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(
    private userUseCases: UserUseCases,
    private readonly notificationsService: NotificationService,
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
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.userUseCases.createUser(createUserDto);

      this.notificationsService.add(
        new SignUpEvent(response.user as unknown as UserAttributes, req),
      );

      return {
        ...response,
        user: {
          ...response.user,
          root_folder_id: response.user.rootFolderId,
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
}
