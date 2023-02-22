import { FolderDto } from '../../folder/dto/folder.dto';

export class FileDto {
  id: number;
  fileId: string;
  name: string;
  plainName: string;
  type: string;
  size: bigint;
  bucket: string;
  folderId: number;
  folder: FolderDto;
  folderUuid: FolderDto['uuid'];
  encryptVersion: string;
  deleted: boolean;
  deletedAt: Date;
  userId: number;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
