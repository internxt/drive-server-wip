import { FileStatus } from './file.domain';

export enum FileQueryStatus {
  EXISTS = FileStatus.EXISTS,
  TRASHED = FileStatus.TRASHED,
  DELETED = FileStatus.DELETED,
  ALL = 'ALL',
}
