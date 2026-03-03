import {
  LookUpRepository,
  SequelizeLookUpRepository,
} from './look-up.repository';
import { Inject } from '@nestjs/common';
import { type FuzzySearchResult } from './dto/fuzzy-search-result.dto';
import { type Workspace } from '../workspaces/domains/workspaces.domain';
export class FuzzySearchUseCases {
  constructor(
    @Inject(SequelizeLookUpRepository)
    private readonly repository: LookUpRepository,
  ) {}

  fuzzySearch(
    user: string,
    text: string,
    offset = 0,
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.search(user, text, offset);
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
