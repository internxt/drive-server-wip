import {
  LookUpRepository,
  SequelizeLookUpRepository,
} from './look-up.repository';
import { Inject } from '@nestjs/common';
import { type FuzzySearchResult } from './dto/fuzzy-search-result.dto';
import { type Workspace } from '../workspaces/domains/workspaces.domain';
import { type UserAttributes } from '../user/user.attributes';

export class FuzzySearchUseCases {
  constructor(
    @Inject(SequelizeLookUpRepository)
    private readonly repository: LookUpRepository,
  ) {}

  fuzzySearch(
    userUuid: UserAttributes['uuid'],
    text: string,
    offset = 0,
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.search(userUuid, text, offset);
  }

  workspaceFuzzySearch(
    userUuid: string,
    workspace: Workspace,
    text: string,
    offset = 0,
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.workspaceSearch(
      userUuid,
      workspace.workspaceUserId,
      workspace.id,
      text,
      offset,
    );
  }
}
