import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  Logger,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
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
    @Req() request: Request,
    @Res() response: Response,
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
      if (err instanceof InvalidReferralCodeError) {
        return response.status(400).send({ error: err.message });
      }

      if (err instanceof UserAlreadyRegisteredError) {
        return response.status(409).send({ error: err.message });
      }

      new Logger().error(
        `[AUTH/REGISTER] ERROR: ${
          (err as Error).message
        }, BODY ${JSON.stringify(request.body)}, STACK: ${
          (err as Error).stack
        }`,
      );

      return response.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
