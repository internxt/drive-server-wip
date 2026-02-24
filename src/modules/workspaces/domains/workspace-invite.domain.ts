import { type WorkspaceInviteAttributes } from '../attributes/workspace-invite.attribute';

export class WorkspaceInvite implements WorkspaceInviteAttributes {
  id: string;
  workspaceId: string;
  invitedUser: string;
  encryptionAlgorithm: string;
  encryptionKey: string;
  spaceLimit: number;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    invitedUser,
    encryptionAlgorithm,
    encryptionKey,
    spaceLimit,
    createdAt,
    updatedAt,
  }: WorkspaceInviteAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.invitedUser = invitedUser;
    this.encryptionAlgorithm = encryptionAlgorithm;
    this.encryptionKey = encryptionKey;
    this.spaceLimit = spaceLimit;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(attributes: WorkspaceInviteAttributes): WorkspaceInvite {
    return new WorkspaceInvite(attributes);
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      invitedUser: this.invitedUser,
      encryptionAlgorithm: this.encryptionAlgorithm,
      encryptionKey: this.encryptionKey,
      spaceLimit: this.spaceLimit,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
