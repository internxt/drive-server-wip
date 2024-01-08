import { FileStatus } from '../src/modules/file/file.domain';
import * as fixtures from './fixtures';

describe('Testing fixtures tests', () => {
  describe("User's fixture", () => {
    it('When it generates a user, then the identifier should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.id).toBeGreaterThan(0);
      expect(user.id).not.toBe(otherUser.id);
    });

    it('When it generates a user, then the uuid should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.uuid).not.toBe(otherUser.uuid);
    });

    it('When it generates a user, then the email should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.email).not.toBe(otherUser.email);
    });

    it('When it generates a user, then the rootFolderId should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.rootFolderId).not.toBe(otherUser.rootFolderId);
    });
  });

  describe("Folder's fixture", () => {
    it('When it generates a folder, then the identifier should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.id).toBeGreaterThan(0);
      expect(folder.id).not.toBe(otherFolder.id);
    });

    it('When it generates a folder, then the uuid should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.uuid).not.toBe(otherFolder.uuid);
    });

    it('When it generates a folder, then the parentId should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.parentId).not.toBe(otherFolder.parentId);
    });

    it('When it generates a folder with owner, then the userId should be the owner id', () => {
      const owner = fixtures.newUser();
      const folder = fixtures.newFolder({ owner });

      expect(folder.userId).toBe(owner.id);
    });

    it('When it generates a folder without owner, then the userId should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.userId).not.toEqual(otherFolder.userId);
    });

    it('When it generates a folder, then the createdAt should be equal or less than updatedAt', () => {
      const folder = fixtures.newFolder();

      expect(folder.createdAt.getTime()).toBeLessThanOrEqual(
        folder.updatedAt.getTime(),
      );
    });

    it(`When it generates a folder, then the bucket length is ${fixtures.constants.BUCKET_ID_LENGTH}`, () => {
      const folder = fixtures.newFolder();

      expect(folder.bucket.length).toBe(fixtures.constants.BUCKET_ID_LENGTH);
    });

    it('When it generates a folder, then the bucket should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.bucket).not.toBe(otherFolder.bucket);
    });

    it('When it generates a folder, then the plainName should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.plainName).not.toBe(otherFolder.plainName);
    });

    it('When it generates a folder and settable attributes are provided, then those attributes are set', () => {
      const settableAttributes: fixtures.FolderSettableAttributes = {
        deleted: true,
        deletedAt: new Date(),
        removed: true,
        removedAt: new Date(),
      };
      const folder = fixtures.newFolder({
        attributes: settableAttributes,
      });

      expect(folder.deleted).toBe(settableAttributes.deleted);
      expect(folder.deletedAt).toBe(settableAttributes.deletedAt);
      expect(folder.removed).toBe(settableAttributes.removed);
      expect(folder.removedAt).toBe(settableAttributes.removedAt);
    });
  });

  describe("Files's fixture", () => {
    it('When it generates a file, then the identifier should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.id).toBeGreaterThan(0);
      expect(file.id).not.toBe(otherFile.id);
    });

    it('When it generates a file, then the uuid should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.uuid).not.toBe(otherFile.uuid);
    });

    it('When it generates a file with owner, then the userId should be the owner id', () => {
      const owner = fixtures.newUser();
      const file = fixtures.newFile({ owner });

      expect(file.userId).toBe(owner.id);
    });

    it('When it generates a file without owner, then the userId should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.userId).not.toEqual(otherFile.userId);
    });

    it('When it generates a file, then the createdAt should be equal or less than updatedAt', () => {
      const file = fixtures.newFile();

      expect(file.createdAt.getTime()).toBeLessThanOrEqual(
        file.updatedAt.getTime(),
      );
    });

    it(`When it generates a file, then the bucket length is ${fixtures.constants.BUCKET_ID_LENGTH}`, () => {
      const file = fixtures.newFile();

      expect(file.bucket.length).toBe(fixtures.constants.BUCKET_ID_LENGTH);
    });

    it('When it generates a file, then the bucket should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.bucket).not.toBe(otherFile.bucket);
    });

    it('When it generates a file, then the plainName should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.plainName).not.toBe(otherFile.plainName);
    });

    it('When it generates a file and settable attributes are provided, then those attributes are set', () => {
      const settableAttributes: fixtures.FilesSettableAttributes = {
        deleted: true,
        deletedAt: new Date(),
        removed: true,
        removedAt: new Date(),
        status: FileStatus.DELETED,
      };
      const file = fixtures.newFile({
        attributes: settableAttributes,
      });

      expect(file.deleted).toBe(settableAttributes.deleted);
      expect(file.deletedAt).toBe(settableAttributes.deletedAt);
      expect(file.removed).toBe(settableAttributes.removed);
      expect(file.removed).toBe(settableAttributes.removed);
      expect(file.status).toBe(settableAttributes.status);
    });

    it('When it generates a file and a folder is provided, then that folder should be set', () => {
      const folder = fixtures.newFolder();
      const file = fixtures.newFile({
        folder,
      });

      expect(file.folder).toEqual(folder);
      expect(file.folderId).toEqual(folder.id);
      expect(file.folderUuid).toEqual(folder.uuid);
    });
  });
});
