export interface WorkspaceUserAttributes {
  id: string;
  memberId: string;
  key: string;
  workspaceId: string;
  spaceLimit: bigint;
  driveUsage: bigint;
  backupsUsage: bigint;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
