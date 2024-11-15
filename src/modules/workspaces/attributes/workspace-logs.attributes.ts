export enum WorkspaceLogType {
  LOGIN = 'LOGIN',
  RESET_PASSWORD = 'RESET_PASSWORD',
  LOGOUT = 'LOGOUT',
  SHARE_FILE = 'SHARE_FILE',
  SHARE_FOLDER = 'SHARE_FOLDER',
  DELETE_FILE = 'DELETE_FILE',
  UPLOAD_FILE = 'UPLOAD_FILE',
  DOWNLOAD_FILE = 'DOWNLOAD_FILE',
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
  createdAt: Date;
  updatedAt: Date;
}
