import { FolderAttributes } from '../../folder/folder.attributes';
import { User } from '../../user/user.domain';
import { Workspace } from '../../workspaces/domains/workspaces.domain';
import { SharedWithType } from '../sharing.domain';

export interface SharingAccessTokenData {
  owner?: {
    uuid?: User['uuid'];
  };
  sharedRootFolderId?: FolderAttributes['uuid'];
  sharedWithType: SharedWithType;
  workspace?: {
    workspaceId: Workspace['id'];
  };
}
