import { UserAttributes } from '../../user/user.attributes';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';

export class Workspace implements WorkspaceAttributes {
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

  constructor({
    id,
    ownerId,
    address,
    name,
    description,
    defaultTeamId,
    workspaceUserId,
    setupCompleted,
    createdAt,
    updatedAt,
  }: WorkspaceAttributes) {
    this.id = id;
    this.ownerId = ownerId;
    this.address = address;
    this.name = name;
    this.description = description;
    this.defaultTeamId = defaultTeamId;
    this.workspaceUserId = workspaceUserId;
    this.setupCompleted = setupCompleted;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(user: WorkspaceAttributes): Workspace {
    return new Workspace(user);
  }

  isUserOwner(userUuid: UserAttributes['uuid']) {
    return userUuid === this.ownerId;
  }

  toJSON() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      address: this.address,
      name: this.name,
      description: this.description,
      defaultTeamId: this.defaultTeamId,
      workspaceUserId: this.workspaceUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
