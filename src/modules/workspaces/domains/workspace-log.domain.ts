import {
  type WorkspaceLogAttributes,
  type WorkspaceLogPlatform,
  type WorkspaceLogType,
} from '../attributes/workspace-logs.attributes';

export class WorkspaceLog implements WorkspaceLogAttributes {
  id: string;
  workspaceId: string;
  creator: string;
  type: WorkspaceLogType;
  platform: WorkspaceLogPlatform;
  entityId?: string;
  user?: any;
  workspace?: any;
  file?: any;
  folder?: any;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    creator,
    type,
    platform,
    entityId,
    user,
    workspace,
    file,
    folder,
    createdAt,
    updatedAt,
  }: WorkspaceLogAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.creator = creator;
    this.type = type;
    this.platform = platform;
    this.entityId = entityId;
    this.user = user;
    this.workspace = workspace;
    this.file = file;
    this.folder = folder;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(user: WorkspaceLogAttributes): WorkspaceLog {
    return new WorkspaceLog(user);
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      creator: this.creator,
      type: this.type,
      platform: this.platform,
      entityId: this.entityId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
