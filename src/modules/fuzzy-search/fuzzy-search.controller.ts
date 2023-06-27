import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

class RequestBody {
  @ApiProperty() fileId: string;
  @ApiProperty() name: string;
  @ApiProperty() userId: string;
}

@ApiTags('Fuzzy')
@Controller('fuzzy')
export class FuzzySearchController {
  constructor(private readonly usecases: FuzzySearchUseCases) {}

  @Get('/:userId/:search')
  @Public()
  async fuzzySearch(
    @Param('userId') userId: string,
    @Param('serach') search: string,
  ) {
    return await this.usecases.fuzzySearch(userId, search);
  }

  @Put('/')
  @Public()
  async add(@Body() content: RequestBody) {
    await this.usecases.manualInsert({
      id: content.fileId,
      userUuid: content.userId,
      name: content.name,
    });
  }
}
