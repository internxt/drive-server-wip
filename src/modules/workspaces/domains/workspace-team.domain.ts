import { type User } from '../../user/user.domain';
import { type WorkspaceTeamAttributes } from '../attributes/workspace-team.attributes';

export class WorkspaceTeam implements WorkspaceTeamAttributes {
  id: string;
  workspaceId: string;
  managerId: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    managerId,
    name,
    createdAt,
    updatedAt,
  }: WorkspaceTeamAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.managerId = managerId;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isUserManager(user: User) {
    return user.uuid === this.managerId;
  }

  static build(teamAttributes: WorkspaceTeamAttributes): WorkspaceTeam {
    return new WorkspaceTeam(teamAttributes);
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      managerId: this.managerId,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
