import {
  LookUpRepository,
  SequelizeLookUpRepository,
} from './look-up.repository';
import { Inject } from '@nestjs/common';
import { FuzzySearchResult } from './dto/fuzzy-search-result.dto';
import { Workspace } from '../workspaces/domains/workspaces.domain';
export class FuzzySearchUseCases {
  constructor(
    @Inject(SequelizeLookUpRepository)
    private repository: LookUpRepository,
  ) {}

  fuzzySearch(user: string, text: string): Promise<Array<FuzzySearchResult>> {
    return this.repository.search(user, text, 0);
  }

  workspaceFuzzySearch(
    userUuid: string,
    workspace: Workspace,
    text: string,
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.workspaceSearch(
      userUuid,
      workspace.workspaceUserId,
      workspace.id,
      text,
      0,
    );
  }
}
