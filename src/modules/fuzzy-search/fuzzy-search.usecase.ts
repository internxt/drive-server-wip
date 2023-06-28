import { LookUpRepository } from './look-up.repository';
import { LookUp } from './look-up.domain';
import { Inject } from '@nestjs/common';
export class FuzzySearchUseCases {
  constructor(
    @Inject('Look_Up_Repository')
    private repository: LookUpRepository,
  ) {}

  async fuzzySearch(user: string, text: string): Promise<Array<LookUp>> {
    return this.repository.search(user, text, 0);
  }
}
