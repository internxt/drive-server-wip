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

  describe("PrivateSharingFolder's fixture", () => {
    it('When it generates a private sharing folder and no params are provided, then the attributes should be random', () => {
      const privateSharingFolder = fixtures.newPrivateSharingFolder();
      const otherPrivateSharingFolder = fixtures.newPrivateSharingFolder();

      expect(privateSharingFolder.id).not.toBe(otherPrivateSharingFolder.id);
      expect(privateSharingFolder.folderId).not.toBe(
        otherPrivateSharingFolder.folderId,
      );
      expect(privateSharingFolder.ownerId).not.toBe(
        otherPrivateSharingFolder.ownerId,
      );
      expect(privateSharingFolder.sharedWith).not.toBe(
        otherPrivateSharingFolder.sharedWith,
      );
      expect(privateSharingFolder.createdAt.getTime()).not.toBe(
        otherPrivateSharingFolder.createdAt.getTime(),
      );
      expect(privateSharingFolder.encryptionKey).not.toBe(
        otherPrivateSharingFolder.encryptionKey,
      );
    });

    it('When it generates a private sharing folder if the folder is provided, then the folderId should not be random', () => {
      const folder = fixtures.newFolder();
      const privateSharingFolder = fixtures.newPrivateSharingFolder({
        folder,
      });

      expect(privateSharingFolder.folderId).toBe(folder.uuid);
    });

    it('When it generates a private sharing folder if the owner is provided, then the ownerId should be set', () => {
      const owner = fixtures.newUser();
      const privateSharingFolder = fixtures.newPrivateSharingFolder({
        owner,
      });

      expect(privateSharingFolder.ownerId).toBe(owner.uuid);
    });

    it('When it generates a private sharing folder if the sharedWith is provided, then the sharedWith should be set', () => {
      const sharedWith = fixtures.newUser();
      const privateSharingFolder = fixtures.newPrivateSharingFolder({
        sharedWith,
      });

      expect(privateSharingFolder.sharedWith).toBe(sharedWith.uuid);
    });

    it('When it generates a private sharing folder, then the encrytionKey should be random', () => {
      const privateSharingFolder = fixtures.newPrivateSharingFolder();
      const otherPrivateSharingFolder = fixtures.newPrivateSharingFolder();

      expect(privateSharingFolder.encryptionKey).not.toBe(
        otherPrivateSharingFolder.encryptionKey,
      );
    });
  });
});
