import { User } from '../../user/user.domain';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { WorkspaceTeam } from './workspace-team.domain';

export class Workspace implements WorkspaceAttributes {
  id: string;
  ownerId: string;
  address?: string;
  rootFolderId?: string;
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
    rootFolderId,
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
    this.rootFolderId = rootFolderId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(user: WorkspaceAttributes): Workspace {
    return new Workspace(user);
  }

  isUserOwner(user: User) {
    return user.uuid === this.ownerId;
  }

  isWorkspaceReady() {
    return this.setupCompleted === true;
  }

  isDefaultTeam(team: WorkspaceTeam) {
    return this.defaultTeamId === team.id;
  }

  toJSON() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      address: this.address,
      name: this.name,
      description: this.description,
      rootFolderId: this.rootFolderId,
      defaultTeamId: this.defaultTeamId,
      workspaceUserId: this.workspaceUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
