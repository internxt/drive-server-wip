import { FolderAttributes } from '../../folder/folder.attributes';
import { User } from '../../user/user.domain';
import { Workspace } from '../../workspaces/domains/workspaces.domain';
import { SharedWithType } from '../sharing.domain';

export interface SharingAccessTokenData {
  sharedRootFolderId?: FolderAttributes['uuid'];
  sharedWithType: SharedWithType;
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
  workspaceId?: Workspace['id'];
  isSharedItem?: boolean;
}
