import { WorkspaceItemUserAttributes } from '../attributes/workspace-items-users.attributes';

export class WorkspaceItemUser implements WorkspaceItemUserAttributes {
  id: string;
  workspaceId: string;
  itemId: string;
  itemType: string;
  context: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    itemId,
    itemType,
    context,
    createdBy,
    createdAt,
    updatedAt,
  }: WorkspaceItemUserAttributes) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.itemId = itemId;
    this.itemType = itemType;
    this.context = context;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(attributes: WorkspaceItemUserAttributes): WorkspaceItemUser {
    return new WorkspaceItemUser(attributes);
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      itemId: this.itemId,
      itemType: this.itemType,
      context: this.context,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
