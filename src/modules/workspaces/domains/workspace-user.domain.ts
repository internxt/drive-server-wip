import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';
import { User } from '../../user/user.domain';

export class WorkspaceUser implements WorkspaceUserAttributes {
  id: string;
  memberId: string;
  member: User;
  key: string;
  workspaceId: string;
  rootFolderId?: string;
  spaceLimit: number;
  driveUsage: number;
  backupsUsage: number;
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
    rootFolderId,
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
    this.rootFolderId = rootFolderId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(workspaceUser: WorkspaceUserAttributes): WorkspaceUser {
    return new WorkspaceUser(workspaceUser);
  }

  setMember(member: User) {
    this.member = member;
  }

  getUsedSpace(): number {
    return this.driveUsage + this.backupsUsage;
  }

  getFreeSpace(): number {
    return this.spaceLimit - this.getUsedSpace();
  }

  hasEnoughSpaceForFile(size: number): boolean {
    return this.getFreeSpace() >= size;
  }

  addDriveUsage(fileSize: number): void {
    this.driveUsage += fileSize;
  }

  toJSON() {
    return {
      id: this.id,
      memberId: this.memberId,
      key: this.key,
      workspaceId: this.workspaceId,
      rootFolderId: this.rootFolderId,
      spaceLimit: this.spaceLimit,
      driveUsage: this.driveUsage,
      backupsUsage: this.backupsUsage,
      deactivated: this.deactivated,
      member: this.member ? this.member.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
