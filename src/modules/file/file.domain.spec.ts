import { newFile } from '../../../test/fixtures';
import { File, FileStatus } from './file.domain';

describe('File Domain', () => {
  describe('legacy status fields', () => {
    it('When file exists, then deleted and removed are false with null dates', () => {
      const file = File.build({ ...newFile(), status: FileStatus.EXISTS });

      const json = file.toJSON();

      expect(json).toMatchObject({
        deleted: false,
        deletedAt: null,
        removed: false,
        removedAt: null,
      });
    });

    it('When file is trashed, then deleted is true and deletedAt is updatedAt', () => {
      const updatedAt = new Date();
      const file = File.build({
        ...newFile(),
        status: FileStatus.TRASHED,
        updatedAt,
      });

      const json = file.toJSON();

      expect(json).toMatchObject({
        deleted: true,
        deletedAt: updatedAt,
        removed: false,
        removedAt: null,
      });
    });

    it('When file is deleted, then deleted and removed are true with updatedAt dates', () => {
      const updatedAt = new Date();
      const file = File.build({
        ...newFile(),
        status: FileStatus.DELETED,
        updatedAt,
      });

      const json = file.toJSON();

      expect(json).toMatchObject({
        deleted: true,
        deletedAt: updatedAt,
        removed: true,
        removedAt: updatedAt,
      });
      expect(file.isDeleted()).toBe(true);
    });
  });
});
