import { User } from '../../../../src/modules/user/user.domain';
import { Role, Sharing } from '../sharing.domain';
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
  role: Role['name'];
}

export interface GetSharedItemsReponse<Item> {
  items: Item[];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
  encryptionKey: Sharing['encryptionKey'] | null;
  token: string;
  bucket: string;
  parent?: Pick<Folder, 'uuid' | 'name'>;
  role: Role['name'];
}

export type GetFoldersReponse = GetSharedItemsReponse<FolderWithSharedInfo>;
export type GetFilesResponse = GetSharedItemsReponse<FileWithSharedInfo>;

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
  sharingId?: Sharing['id'];
  credentials: {
    networkPass: User['userId'];
    networkUser: User['bridgeUser'];
  };
}
