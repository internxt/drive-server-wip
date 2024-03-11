export interface WorkspaceUserAttributes {
  id: string;
  memberId: string;
  key: string;
  workspaceId: string;
  spaceLimit: number;
  driveUsage: number;
  backupsUsage: number;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
