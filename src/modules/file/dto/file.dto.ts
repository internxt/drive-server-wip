import { FolderDto } from '../../folder/dto/folder.dto';

export class FileDto {
  id: number;
  fileId: string;
  name: string;
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
  plainName: string;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
