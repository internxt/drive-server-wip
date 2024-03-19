import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';

export class WorkspaceUser implements WorkspaceUserAttributes {
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

  constructor({
    id,
    memberId,
    key,
    workspaceId,
    spaceLimit,
    driveUsage,
    backupsUsage,
    deactivated,
    createdAt,
    updatedAt,
  }: WorkspaceUserAttributes) {
    this.id = id;
    this.memberId = memberId;
    this.key = key;
    this.workspaceId = workspaceId;
    this.spaceLimit = spaceLimit;
    this.driveUsage = driveUsage;
    this.backupsUsage = backupsUsage;
    this.deactivated = deactivated;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(workspaceUser: WorkspaceUserAttributes): WorkspaceUser {
    return new WorkspaceUser(workspaceUser);
  }

  toJSON() {
    return {
      id: this.id,
      memberId: this.memberId,
      key: this.key,
      workspaceId: this.workspaceId,
      spaceLimit: this.spaceLimit.toString(),
      driveUsage: this.driveUsage.toString(),
      backupsUsage: this.backupsUsage.toString(),
      deactivated: this.deactivated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
