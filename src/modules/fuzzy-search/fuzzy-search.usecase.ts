import { LookUpRepository } from './look-up.repository';
import { Inject } from '@nestjs/common';
import { FuzzySearchResult } from './dto/fuzzy-search-result.dto';
export class FuzzySearchUseCases {
  constructor(
    @Inject('Look_Up_Repository')
    private repository: LookUpRepository,
  ) {}

  fuzzySearch(user: string, text: string): Promise<Array<FuzzySearchResult>> {
    return this.repository.search(user, text, 0);
  }
}
