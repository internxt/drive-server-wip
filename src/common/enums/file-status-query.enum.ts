import { FileStatus } from '../../modules/file/file.domain';

export enum FileStatusQuery {
  ALL = 'ALL',
  EXISTS = FileStatus.EXISTS,
  TRASHED = FileStatus.TRASHED,
  DELETED = FileStatus.DELETED,
}
