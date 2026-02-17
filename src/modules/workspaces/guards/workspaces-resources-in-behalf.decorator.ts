import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { WorkspacesResourcesItemsInBehalfGuard } from './workspaces-resources-in-items-in-behalf.guard';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { SharingPermissionsGuard } from '../../sharing/guards/sharing-permissions.guard';
import {
  WorkspaceResourcesAction,
  WORKSPACE_IN_BEHALF_ACTION_META_KEY,
} from './workspaces-resources-in-behalf.types';

interface ValidationOptions {
  defaultItemType?: WorkspaceItemType;
  action?: WorkspaceResourcesAction;
}

// Re-export
export { WorkspaceResourcesAction, WORKSPACE_IN_BEHALF_ACTION_META_KEY };

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
