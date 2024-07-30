import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { WorkspacesResourcesItemsInBehalfGuard } from './workspaces-resources-in-items-in-behalf.guard';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { SharingPermissionsGuard } from '../../sharing/guards/sharing-permissions.guard';

export interface DataSource {
  sourceKey?: 'body' | 'query' | 'params' | 'headers';
  newFieldName?: string; // renames field name to be passed to guard
  fieldName: string;
  value?: any;
}
export interface ValidationOptions {
  defaultItemType?: WorkspaceItemType;
  action?: WorkspaceResourcesAction;
}

export enum WorkspaceResourcesAction {
  AddItemsToTrash = 'addItemsToTrash',
  DeleteItemsFromTrash = 'deleteItemsFromTrash',
  Default = 'default',
}

export const WORKSPACE_IN_BEHALF_SOURCES_META_KEY = 'workspaceInBehalfMetakey';
export const WORKSPACE_IN_BEHALF_ACTION_META_KEY =
  'workspaceInBehalfActionMetakey';

const createValidationDecorator = (
  dataSources: DataSource[],
  options?: ValidationOptions,
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
    SetMetadata(WORKSPACE_IN_BEHALF_ACTION_META_KEY, options?.action),
    // TODO: rename this guard or remove sharings from here
    UseGuards(SharingPermissionsGuard, WorkspacesResourcesItemsInBehalfGuard),
  );
};

export const WorkspacesInBehalfValidationFolder = (dataSources: DataSource[]) =>
  createValidationDecorator(dataSources, {
    defaultItemType: WorkspaceItemType.Folder,
  });

export const WorkspacesInBehalfGuard = (
  dataSources: DataSource[],
  action?: WorkspaceResourcesAction,
) =>
  createValidationDecorator(dataSources, {
    action,
  });

export const WorkspacesInBehalfValidationFile = (dataSources: DataSource[]) =>
  createValidationDecorator(dataSources, {
    defaultItemType: WorkspaceItemType.File,
  });
