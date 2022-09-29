import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import {
  InvalidReferralCodeError,
  UserAlreadyRegisteredError,
  UserUseCases,
} from './user.usecase';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(private userUseCases: UserUseCases) {}

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
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const response = await this.userUseCases.createUser(createUserDto);

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
