export interface WorkspaceInviteAttributes {
  id: string;
  workspaceId: string;
  invitedUser: string;
  encryptionAlgorithm: string;
  encryptionKey: string;
  spaceLimit: bigint;
  createdAt: Date;
  updatedAt: Date;
}
