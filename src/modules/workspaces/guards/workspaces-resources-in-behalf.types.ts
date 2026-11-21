export enum WorkspaceResourcesAction {
  AddItemsToTrash = 'addItemsToTrash',
  DeleteItemsFromTrash = 'deleteItemsFromTrash',
  RestoreItemsFromTrash = 'restoreItemsFromTrash',
  ModifySharingById = 'modifySharingById',
  Default = 'default',
}

export const WORKSPACE_IN_BEHALF_ACTION_META_KEY =
  'workspaceInBehalfActionMetakey';
