export enum WorkspaceItemType {
  File = 'file',
  Folder = 'folder',
}

export enum WorkspaceItemContext {
  Drive = 'drive',
  Backup = 'backup',
}

export interface WorkspaceItemUserAttributes {
  id: string;
  workspaceId: string;
  itemId: string;
  itemType: WorkspaceItemType;
  context: WorkspaceItemContext;
  createdBy: string;
  creator?: any;
  createdAt: Date;
  updatedAt: Date;
}
