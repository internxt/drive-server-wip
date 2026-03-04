import { type User } from '../../user/user.domain';
import { type WorkspaceTeam } from './workspace-team.domain';
import { type WorkspaceTeamUserAttributes } from '../attributes/workspace-team-users.attributes';

export class WorkspaceTeamUser implements WorkspaceTeamUserAttributes {
  id: string;
  teamId: string;
  memberId: string;
  team?: WorkspaceTeam;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    teamId,
    memberId,
    team,
    createdAt,
    updatedAt,
  }: WorkspaceTeamUserAttributes & { team?: WorkspaceTeam }) {
    this.id = id;
    this.teamId = teamId;
    this.memberId = memberId;
    this.team = team;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(
    workspaceTeamUser: WorkspaceTeamUserAttributes & {
      team?: WorkspaceTeam;
      member?: User;
    },
  ): WorkspaceTeamUser {
    return new WorkspaceTeamUser(workspaceTeamUser);
  }

  toJSON() {
    return {
      id: this.id,
      teamId: this.teamId,
      memberId: this.memberId,
      team: this.team ? this.team.toJSON() : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
