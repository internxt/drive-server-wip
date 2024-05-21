export interface WorkspaceUserAttributes {
  id: string;
  memberId: string;
  member?: any;
  key: string;
  workspaceId: string;
  spaceLimit: bigint;
  rootFolderId?: string;
  driveUsage: bigint;
  backupsUsage: bigint;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
