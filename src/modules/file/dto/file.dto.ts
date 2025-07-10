import { Sharing } from '../../../modules/sharing/sharing.domain';
import { FolderDto } from '../../folder/dto/folder.dto';
import { Thumbnail } from '../../thumbnail/thumbnail.domain';
import { FileStatus } from '../file.domain';

export class FileDto {
  id: number;
  uuid: string;
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
  removed: boolean;
  deletedAt: Date;
  userId: number;
  plainName: string;
  creationTime: Date;
  modificationTime: Date;
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date;
  status: FileStatus;
  thumbnails?: Thumbnail[];
  sharings?: Sharing[];
}
