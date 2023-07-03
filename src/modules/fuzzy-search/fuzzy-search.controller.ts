import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '../user/user.domain';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
    description: 'Elements founded',
    type: FuzzySearchResults,
  })
  @Public()
  async fuzzySearch(
    @UserDecorator() user: User,
    @Param('search') search: string,
  ): Promise<FuzzySearchResults> {
    const data = await this.usecases.fuzzySearch(user.uuid, search);

    return { data };
  }
}
