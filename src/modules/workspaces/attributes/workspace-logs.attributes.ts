export enum WorkspaceLogType {
  LOGIN = 'LOGIN',
  CHANGED_PASSWORD = 'CHANGED_PASSWORD',
  LOGOUT = 'LOGOUT',
  SHARE = 'SHARE',
  SHARE_FILE = 'SHARE_FILE',
  SHARE_FOLDER = 'SHARE_FOLDER',
  DELETE = 'DELETE',
  DELETE_FILE = 'DELETE_FILE',
  DELETE_FOLDER = 'DELETE_FOLDER',
  DELETE_ALL = 'DELETE_ALL',
}

export enum WorkspaceLogPlatform {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  DESKTOP = 'DESKTOP',
  UNSPECIFIED = 'UNSPECIFIED',
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
