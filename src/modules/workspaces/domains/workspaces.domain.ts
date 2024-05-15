import { User } from '../../user/user.domain';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';
import { WorkspaceTeam } from './workspace-team.domain';

export class Workspace implements WorkspaceAttributes {
  id: string;
  ownerId: string;
  address?: string;
  name: string;
  description?: string;
  avatar: string;
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
    avatar,
    createdAt,
    updatedAt,
  }: WorkspaceAttributes) {
    this.id = id;
    this.ownerId = ownerId;
    this.address = address;
    this.name = name;
    this.avatar = avatar;
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
      defaultTeamId: this.defaultTeamId,
      avatar: this.avatar,
      workspaceUserId: this.workspaceUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
