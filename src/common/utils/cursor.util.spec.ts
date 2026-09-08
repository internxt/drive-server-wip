import { IsInt, IsString } from 'class-validator';
import { decodeCursor, encodeCursor } from './cursor.util';

class TestCursorDto {
  @IsString()
  name: string;

  @IsInt()
  age: number;
}

describe('cursor.util', () => {
  describe('encodeCursor/decodeCursor', () => {
    it('When a valid cursor is encoded and decoded, then it should return the original data', () => {
      const cursor: TestCursorDto = { name: 'alice', age: 30 };

      const token = encodeCursor(cursor);
      const decoded = decodeCursor(TestCursorDto, token);

      expect(decoded).toEqual(cursor);
    });

    it('When the token is not valid base64/JSON, then it should return null', () => {
      expect(decodeCursor(TestCursorDto, 'not-a-valid-token!!!')).toBeNull();
    });

    it('When the decoded JSON fails the DTO validation, then it should return null', () => {
      const token = Buffer.from(
        JSON.stringify({ name: 'alice', age: 'not-a-number' }),
      ).toString('base64');

      expect(decodeCursor(TestCursorDto, token)).toBeNull();
    });

    it('When the decoded JSON is missing fields, then it should return null', () => {
      const token = Buffer.from(JSON.stringify({ name: 'alice' })).toString(
        'base64',
      );

      expect(decodeCursor(TestCursorDto, token)).toBeNull();
    });
  });
});
