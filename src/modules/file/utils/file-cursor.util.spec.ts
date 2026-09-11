import { v4 } from 'uuid';
import { decodeCursor, encodeCursor } from '../../../common/utils/cursor.util';
import {
  FileUpdatedAtIdCursorDto,
  FileSyncCursorDto,
} from './file-cursor.util';
import { FileStatus } from '../file.domain';

describe('file-cursor.util', () => {
  describe('FileUpdatedAtIdCursorDto', () => {
    it('When a valid cursor is encoded and decoded, then it should return the original data', () => {
      const cursor: FileUpdatedAtIdCursorDto = {
        updatedAt: new Date().toISOString(),
        uuid: v4(),
      };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor(FileUpdatedAtIdCursorDto, token);

      expect(decoded).toEqual(cursor);
    });

    it('When the decoded JSON has an invalid uuid, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: new Date().toISOString(), uuid: 'nope' }),
      ).toString('base64');

      expect(decodeCursor(FileUpdatedAtIdCursorDto, token)).toBeNull();
    });

    it('When the decoded JSON has an invalid updatedAt, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: 'not-a-date', uuid: v4() }),
      ).toString('base64');

      expect(decodeCursor(FileUpdatedAtIdCursorDto, token)).toBeNull();
    });

    it('When updatedAt carries full microsecond precision, then it should still decode successfully', () => {
      const cursor: FileUpdatedAtIdCursorDto = {
        updatedAt: '2026-01-01T10:00:00.123456Z',
        uuid: v4(),
      };

      const token = encodeCursor(cursor);

      expect(decodeCursor(FileUpdatedAtIdCursorDto, token)).toEqual(cursor);
    });
  });

  describe('FileSyncCursorDto', () => {
    it('When a valid sync cursor (with status) is encoded and decoded, then it should return the original data', () => {
      const cursor: FileSyncCursorDto = {
        updatedAt: new Date().toISOString(),
        uuid: v4(),
        status: FileStatus.EXISTS,
      };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor(FileSyncCursorDto, token);

      expect(decoded).toEqual(cursor);
    });

    it('When status is present but not a valid FileStatus, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          uuid: v4(),
          status: 'not-a-status',
        }),
      ).toString('base64');

      expect(decodeCursor(FileSyncCursorDto, token)).toBeNull();
    });

    it('When status is omitted, then it should still decode successfully', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: new Date().toISOString(), uuid: v4() }),
      ).toString('base64');

      expect(decodeCursor(FileSyncCursorDto, token)).not.toBeNull();
    });
  });
});
