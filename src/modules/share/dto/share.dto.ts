import { FolderDto } from '../../folder/dto/folder.dto';
import { FileDto } from '../../file/dto/file.dto';

export class ShareDto {
  id: number;
  token: string;
  mnemonic: string;
  bucket: string;
  isFolder: boolean;
  views: number;
  timesValid: number;
  active: boolean;
  code: string;
  createdAt: Date;
  updatedAt: Date;
  fileId: number;
  fileSize: bigint;
  folderId: number;
  folderUuid: string;
  fileToken: string;
  item: FileDto | FolderDto;
  encryptionKey?: string;
  protected: boolean;
}
