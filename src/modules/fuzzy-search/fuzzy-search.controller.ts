import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { User } from '../user/user.domain';
import { User as UserDecorator } from '../auth/decorators/user.decorator';

class RequestBody {
  @ApiProperty() fileId: string;
  @ApiProperty() name: string;
}

@ApiTags('Fuzzy')
@Controller('fuzzy')
export class FuzzySearchController {
  constructor(private readonly usecases: FuzzySearchUseCases) {}

  @Get('/:search')
  async fuzzySearch(
    @UserDecorator() user: User,
    @Param('search') search: string,
  ) {
    return await this.usecases.fuzzySearch(user.uuid, search);
  }

  @Put('/')
  async add(@UserDecorator() user: User, @Body() content: RequestBody) {
    await this.usecases.manualInsert({
      id: content.fileId,
      userUuid: user.uuid,
      name: content.name,
    });
  }
}
