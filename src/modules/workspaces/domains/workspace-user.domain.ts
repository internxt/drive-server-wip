import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
import { User } from '../../user/user.domain';

export class WorkspaceUser implements WorkspaceUserAttributes {
  id: string;
  memberId: string;
  member: User;
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
    member,
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
    this.setMember(member);
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

  setMember(member: User) {
    this.member = member;
  }

  getUsedSpace(): bigint {
    return this.driveUsage + this.backupsUsage;
  }

  getFreeSpace(): bigint {
    return this.spaceLimit - this.getUsedSpace();
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
      member: this.member ? this.member.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}