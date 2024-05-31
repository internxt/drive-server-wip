export interface WorkspaceInviteAttributes {
  id: string;
  workspaceId: string;
  invitedUser: string;
  encryptionAlgorithm: string;
  encryptionKey: string;
  spaceLimit: number;
  createdAt: Date;
  updatedAt: Date;
}
