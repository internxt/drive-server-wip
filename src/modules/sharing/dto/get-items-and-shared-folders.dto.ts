import { User } from '../../../../src/modules/user/user.domain';
import { Sharing } from '../sharing.domain';
import { Folder } from '../../../../src/modules/folder/folder.domain';
import { File } from '../../../../src/modules/file/file.domain';

export interface GetItemsReponse {
  folders: FolderWithSharedInfo[];
  files: File[];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
  token: string;
}

export interface GetFoldersReponse {
  items: FolderWithSharedInfo[];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
  token: string;
}

export interface GetFilesResponse {
  items: FileWithSharedInfo[];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
  token: string;
}
export interface FolderWithSharedInfo extends Folder {
  encryptionKey: Sharing['encryptionKey'] | null;
  dateShared: Date | null;
  sharedWithMe: boolean | null;
  sharingId?: Sharing['id'];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
}

export interface FileWithSharedInfo extends File {
  encryptionKey: Sharing['encryptionKey'] | null;
  dateShared: Date | null;
  sharedWithMe: boolean | null;
}
