import { type User } from '../../user/user.domain';
import {
  type WorkspaceItemContext,
  type WorkspaceItemType,
  type WorkspaceItemUserAttributes,
} from '../attributes/workspace-items-users.attributes';

export class WorkspaceItemUser implements WorkspaceItemUserAttributes {
  id: string;
  workspaceId: string;
  itemId: string;
  itemType: WorkspaceItemType;
  context: WorkspaceItemContext;
  createdBy: User['uuid'];
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    workspaceId,
    itemType,
    itemId,
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

  isOwnedBy(user: User) {
    return this.createdBy === user.uuid;
  }

  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      context: this.context,
      createdBy: this.createdBy,
      itemId: this.itemId,
      itemType: this.itemType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
