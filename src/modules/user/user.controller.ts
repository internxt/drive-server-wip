import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserUseCases } from './user.usecase';

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
  async createUser(@Body() createUserDto: CreateUserDto) {
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
      console.log(err);
    }
  }
}
