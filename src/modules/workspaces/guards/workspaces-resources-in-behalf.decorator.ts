import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { WorkspacesResourcesItemsInBehalfGuard } from './workspaces-resources-in-items-in-behalf.guard';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { SharingPermissionsGuard } from '../../sharing/guards/sharing-permissions.guard';

export interface ValidationOptions {
  defaultItemType?: WorkspaceItemType;
  action?: WorkspaceResourcesAction;
}

export enum WorkspaceResourcesAction {
  AddItemsToTrash = 'addItemsToTrash',
  DeleteItemsFromTrash = 'deleteItemsFromTrash',
  Default = 'default',
}

export const WORKSPACE_IN_BEHALF_ACTION_META_KEY =
  'workspaceInBehalfActionMetakey';

const createValidationDecorator = (options?: ValidationOptions) => {
  return applyDecorators(
    SetMetadata(WORKSPACE_IN_BEHALF_ACTION_META_KEY, options?.action),
    // TODO: rename this guard or remove sharings from here
    UseGuards(SharingPermissionsGuard, WorkspacesResourcesItemsInBehalfGuard),
  );
};

export const WorkspacesInBehalfValidationFolder = () =>
  createValidationDecorator({
    defaultItemType: WorkspaceItemType.Folder,
  });

export const WorkspacesInBehalfGuard = (action?: WorkspaceResourcesAction) =>
  createValidationDecorator({
    action,
  });

export const WorkspacesInBehalfValidationFile = () =>
  createValidationDecorator({
    defaultItemType: WorkspaceItemType.File,
  });
