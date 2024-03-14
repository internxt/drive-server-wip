export interface WorkspaceAttributes {
  id: string;
  ownerId: string;
  address?: string;
  name: string;
  description?: string;
  defaultTeamId: string;
  workspaceUserId: string;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
