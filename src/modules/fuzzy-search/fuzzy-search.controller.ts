import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '../user/user.domain';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { FuzzySearchResults } from './dto/fuzzy-search-result.dto';

@ApiTags('Fuzzy')
@Controller('fuzzy')
export class FuzzySearchController {
  constructor(private readonly usecases: FuzzySearchUseCases) {}

  @Get('/:search')
  @ApiOperation({
    summary: 'Search for items from a part of the name',
  })
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Elements found',
    type: FuzzySearchResults,
  })
  async fuzzySearch(
    @UserDecorator() user: User,
    @Param('search') search: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<FuzzySearchResults> {
    const data = await this.usecases.fuzzySearch(user.uuid, search, offset);

    return { data };
  }
}
