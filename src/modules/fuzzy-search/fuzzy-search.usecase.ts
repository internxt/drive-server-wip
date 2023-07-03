import { LookUpRepository } from './look-up.repository';
import { Inject } from '@nestjs/common';
import { FuzzySearchResult } from './dto/fuzzy-search-result.dto';
export class FuzzySearchUseCases {
  constructor(
    @Inject('Look_Up_Repository')
    private repository: LookUpRepository,
  ) {}

  async fuzzySearch(
    user: string,
    text: string,
  ): Promise<Array<FuzzySearchResult>> {
    const lookupResult = await this.repository.search(user, text, 0);

    return lookupResult.map((lookup) => ({
      id: lookup.id,
      itemUuid: lookup.itemUuid,
      itemType: lookup.itemType,
      name: lookup.name,
      rank: lookup.rank,
      similarity: lookup.similarity,
    }));
  }
}
