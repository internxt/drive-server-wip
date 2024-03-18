import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';

export class WorkspaceUser implements WorkspaceUserAttributes {
  id: string;
  workspaceId: string;
  memberId: string;
  key: string;
  spaceLimit: bigint;
  driveUsage: bigint;
  backupsUsage: bigint;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    memberId,
    key,
    spaceLimit,
    driveUsage,
    backupsUsage,
    deactivated,
    createdAt,
    updatedAt,
  }: WorkspaceUserAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.memberId = memberId;
    this.key = key;
    this.spaceLimit = spaceLimit;
    this.driveUsage = driveUsage;
    this.backupsUsage = backupsUsage;
    this.deactivated = deactivated;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(
    workspaceUserAttributes: WorkspaceUserAttributes,
  ): WorkspaceUser {
    return new WorkspaceUser(workspaceUserAttributes);
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      memberId: this.memberId,
      key: this.key,
      spaceLimit: this.spaceLimit,
      driveUsage: this.driveUsage,
      backupsUsage: this.backupsUsage,
      deactivated: this.deactivated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
