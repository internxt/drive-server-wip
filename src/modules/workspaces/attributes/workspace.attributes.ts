export interface WorkspaceAttributes {
  id: string;
  ownerId: string;
  address?: string;
  name: string;
  description?: string;
  avatar: string | null;
  defaultTeamId: string;
  workspaceUserId: string;
  setupCompleted: boolean;
  rootFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}
