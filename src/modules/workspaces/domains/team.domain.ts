import { TeamAttributes } from '../attributes/team.attributes';

export class Team implements TeamAttributes {
  id: string;
  workspaceId: string;
  managerId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    managerId,
    name,
    createdAt,
    updatedAt,
  }: TeamAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.managerId = managerId;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(teamAttributes: TeamAttributes): Team {
    return new Team(teamAttributes);
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
