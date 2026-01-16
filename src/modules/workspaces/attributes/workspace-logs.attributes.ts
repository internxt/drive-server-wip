export enum WorkspaceLogType {
  Login = 'login',
  LoginOpaqueStart = 'login-opaque-start',
  LoginOpaqueFinish = 'login-opaque-finish',
  ChangedPassword = 'changed-password',
  Logout = 'logout',
  ShareFile = 'share-file',
  ShareFolder = 'share-folder',
  DeleteFile = 'delete-file',
  DeleteFolder = 'delete-folder',
}

export enum WorkspaceLogGlobalActionType {
  Share = 'share',
  Delete = 'delete',
  DeleteAll = 'delete-all',
}

export enum WorkspaceLogPlatform {
  Web = 'web',
  Mobile = 'mobile',
  Desktop = 'desktop',
}

export interface WorkspaceLogAttributes {
  id: string;
  workspaceId: string;
  creator: string;
  type: WorkspaceLogType;
  platform: WorkspaceLogPlatform;
  entityId?: string;
  user?: any;
  workspace?: any;
  file?: any;
  folder?: any;
  createdAt: Date;
  updatedAt: Date;
}
