import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { WorkspacesResourcesItemsInBehalfGuard } from './workspaces-resources-in-items-in-behalf.guard';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

export interface DataSource {
  sourceKey?: 'body' | 'query' | 'params' | 'headers';
  newFieldName?: string; // renames field name to be passed to guard
  fieldName: string;
  value?: any;
}

export const WORKSPACE_IN_BEHALF_SOURCES_META_KEY = 'workspaceInBehalfMetakey';

const createValidationDecorator = (
  dataSources: DataSource[],
  options?: { defaultItemType?: WorkspaceItemType },
) => {
  const dataSourcesWithOptions = [...dataSources];

  if (options?.defaultItemType) {
    dataSourcesWithOptions.push({
      fieldName: 'itemType',
      value: options.defaultItemType,
    });
  }

  return applyDecorators(
    SetMetadata(WORKSPACE_IN_BEHALF_SOURCES_META_KEY, dataSourcesWithOptions),
    UseGuards(WorkspacesResourcesItemsInBehalfGuard),
  );
};

export const WorkspacesInBehalfValidationFolder = (dataSources: DataSource[]) =>
  createValidationDecorator(dataSources, {
    defaultItemType: WorkspaceItemType.Folder,
  });

export const WorkspacesInBehalfValidationFile = (dataSources: DataSource[]) =>
  createValidationDecorator(dataSources, {
    defaultItemType: WorkspaceItemType.File,
  });
