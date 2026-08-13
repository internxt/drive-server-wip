import { v4 } from 'uuid';
import {
  decodeCursor,
  encodeCursor,
  type FileUpdatedAtIdCursorDto,
} from './file-cursor.util';

describe('file-cursor.util', () => {
  describe('encodeCursor/decodeCursor', () => {
    it('When a valid cursor is encoded and decoded, then it should return the original data', () => {
      const cursor: FileUpdatedAtIdCursorDto = {
        updatedAt: new Date().toISOString(),
        uuid: v4(),
      };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor<FileUpdatedAtIdCursorDto>(token);

      expect(decoded).toEqual(cursor);
    });

    it('When the token is not valid base64/JSON, then it should return null', () => {
      const decoded = decodeCursor('not-a-valid-token!!!');

      expect(decoded).toBeNull();
    });

    it('When the decoded JSON has an invalid uuid, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: new Date().toISOString(), uuid: 'nope' }),
      ).toString('base64');

      expect(decodeCursor(token)).toBeNull();
    });

    it('When the decoded JSON has an invalid updatedAt, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ updatedAt: 'not-a-date', uuid: v4() }),
      ).toString('base64');

      expect(decodeCursor(token)).toBeNull();
    });

    it('When the decoded JSON is missing fields, then it should return null', () => {
      const token = Buffer.from(JSON.stringify({ uuid: v4() })).toString(
        'base64',
      );

      expect(decodeCursor(token)).toBeNull();
    });
  });
});
