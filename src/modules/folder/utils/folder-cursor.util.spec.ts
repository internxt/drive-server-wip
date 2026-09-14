import { v4 } from 'uuid';
import { decodeCursor, encodeCursor } from '../../../common/utils/cursor.util';
import {
  FolderUpdatedAtIdCursorDto,
  FolderSyncCursorDto,
} from './folder-cursor.util';
import { FolderStatus } from '../folder.domain';

describe('folder-cursor.util', () => {
  describe('FolderUpdatedAtIdCursorDto', () => {
    it('When a valid cursor is encoded and decoded, then it should return the original data', () => {
      const cursor: FolderUpdatedAtIdCursorDto = {
        updatedAt: new Date().toISOString(),
        uuid: v4(),
      };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor(FolderUpdatedAtIdCursorDto, token);

      expect(decoded).toEqual(cursor);
    });

    it('When the decoded JSON has an invalid uuid, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: new Date().toISOString(), uuid: 'nope' }),
      ).toString('base64');

      expect(decodeCursor(FolderUpdatedAtIdCursorDto, token)).toBeNull();
    });

    it('When the decoded JSON has an invalid updatedAt, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: 'not-a-date', uuid: v4() }),
      ).toString('base64');

      expect(decodeCursor(FolderUpdatedAtIdCursorDto, token)).toBeNull();
    });
  });

  describe('FolderSyncCursorDto', () => {
    it('When a valid sync cursor (with status) is encoded and decoded, then it should return the original data', () => {
      const cursor: FolderSyncCursorDto = {
        updatedAt: new Date().toISOString(),
        uuid: v4(),
        status: FolderStatus.EXISTS,
      };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor(FolderSyncCursorDto, token);

      expect(decoded).toEqual(cursor);
    });

    it('When status is present but not a valid FolderStatus, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          uuid: v4(),
          status: 'not-a-status',
        }),
      ).toString('base64');

      expect(decodeCursor(FolderSyncCursorDto, token)).toBeNull();
    });

    it('When status is omitted, then it should still decode successfully', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: new Date().toISOString(), uuid: v4() }),
      ).toString('base64');

      expect(decodeCursor(FolderSyncCursorDto, token)).not.toBeNull();
    });
  });
});
