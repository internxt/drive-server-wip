export interface WorkspaceUserAttributes {
  id: string;
  memberId: string;
  member?: any;
  key: string;
  workspaceId: string;
  spaceLimit: number;
  rootFolderId?: string;
  driveUsage: number;
  backupsUsage: number;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
