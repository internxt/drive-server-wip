import { User } from '../user/user.domain';
import { LookUpRepository } from './look-up.repository';
import { LookUp } from './look-up.domain';
import { Inject } from '@nestjs/common';
export class FuzzySearchUseCases {
  constructor(
    @Inject('Look_Up_Repository')
    private repository: LookUpRepository,
  ) {}

  async fuzzySearch(user: User, text: string): Promise<Array<LookUp>> {
    return [];
  }
}
