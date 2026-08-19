import {
  type FuzzySearchFilters,
  type LookUpRepository,
  SequelizeLookUpRepository,
} from './look-up.repository';
import { Inject } from '@nestjs/common';
import { type FuzzySearchResult } from './dto/fuzzy-search-result.dto';
import { type FuzzySearchQueryDto } from './dto/fuzzy-search-query.dto';
import { type Workspace } from '../workspaces/domains/workspaces.domain';
import { type UserAttributes } from '../user/user.attributes';
import { type ItemType } from './look-up.domain';

const FOLDER_TYPE_FILTER = 'folder';

export class FuzzySearchUseCases {
  constructor(
    @Inject(SequelizeLookUpRepository)
    private readonly repository: LookUpRepository,
  ) {}

  fuzzySearch(
    userUuid: UserAttributes['uuid'],
    text: string,
    query: FuzzySearchQueryDto = {},
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.search(userUuid, text, this.toFilters(query));
  }

  workspaceFuzzySearch(
    userUuid: string,
    workspace: Workspace,
    text: string,
    query: FuzzySearchQueryDto = {},
  ): Promise<Array<FuzzySearchResult>> {
    return this.repository.workspaceSearch(
      userUuid,
      workspace.workspaceUserId,
      workspace.id,
      text,
      this.toFilters(query),
    );
  }

  private toFilters(query: FuzzySearchQueryDto): FuzzySearchFilters {
    const filters: FuzzySearchFilters = {
      offset: query.offset ?? 0,
      minSize: query.minSize,
      maxSize: query.maxSize,
      modifiedAfter: query.modifiedAfter,
      modifiedBefore: query.modifiedBefore,
    };

    if (query.type?.length) {
      const itemTypes: ItemType[] = [];
      const extensions = query.type.filter(
        (type) => type !== FOLDER_TYPE_FILTER,
      );

      if (query.type.includes(FOLDER_TYPE_FILTER)) {
        itemTypes.push('folder');
      }
      if (extensions.length) {
        itemTypes.push('file');
        filters.extensions = [...new Set(extensions)];
      }

      filters.itemTypes = itemTypes;
    }

    return filters;
  }
}
