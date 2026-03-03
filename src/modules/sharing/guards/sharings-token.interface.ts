import { type FolderAttributes } from '../../folder/folder.attributes';
import { type User } from '../../user/user.domain';
import { type Workspace } from '../../workspaces/domains/workspaces.domain';
import { type WorkspaceItemType } from './../../workspaces/attributes/workspace-items-users.attributes';
import { type SharedWithType } from '../sharing.domain';

export interface SharingAccessTokenData {
  sharedRootFolderId?: FolderAttributes['uuid'];
  sharedWithType: SharedWithType;
  sharedWithUserUuid?: User['uuid'];
  parentFolderId?: FolderAttributes['parent']['uuid'];
  owner?: {
    uuid?: User['uuid'];
    id?: User['id'];
  };
  workspace?: {
    workspaceId: Workspace['id'];
  };
  folder?: {
    uuid: FolderAttributes['uuid'];
    id: FolderAttributes['id'];
  };
  item?: {
    uuid: string;
    type: WorkspaceItemType;
  };
  workspaceId?: Workspace['id'];
  isSharedItem?: boolean;
}
