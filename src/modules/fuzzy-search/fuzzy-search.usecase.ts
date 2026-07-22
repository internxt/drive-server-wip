import {
  type FuzzySearchFilters,
  LookUpRepository,
  SequelizeLookUpRepository,
} from './look-up.repository';
import { Inject } from '@nestjs/common';
import { type FuzzySearchResult } from './dto/fuzzy-search-result.dto';
import { type FuzzySearchQueryDto } from './dto/fuzzy-search-query.dto';
import { type Workspace } from '../workspaces/domains/workspaces.domain';
import { type UserAttributes } from '../user/user.attributes';
import { type ItemType } from './look-up.domain';
import { FileCategory, resolveCategoriesToExtensions } from './file-categories';

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
      const fileCategories = query.type.filter(
        (category) => category !== FileCategory.Folder,
      );

      if (query.type.includes(FileCategory.Folder)) {
        itemTypes.push('folder');
      }
      if (fileCategories.length) {
        itemTypes.push('file');
        filters.extensions = resolveCategoriesToExtensions(fileCategories);
      }

      filters.itemTypes = itemTypes;
    }

    return filters;
  }
}
