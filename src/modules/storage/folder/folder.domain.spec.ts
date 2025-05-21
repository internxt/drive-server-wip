import { newFolder } from '../../../../test/fixtures';
import { Folder, FolderStatus } from './folder.domain';

describe('Folder domain', () => {
  it('When the trash check helper is called, then it reflects the trash status of the folder', () => {
    const trashedFolder = newFolder({ attributes: { deleted: true } });
    const notTrashedFolder = newFolder({ attributes: { deleted: false } });

    expect(trashedFolder.isTrashed()).toBe(true);
    expect(notTrashedFolder.isTrashed()).toBe(false);
  });

  it('When the remove check helper is called, then it reflects the remove status of the folder', () => {
    const removedFolder = newFolder({ attributes: { removed: true } });
    const notRemovedFolder = newFolder({ attributes: { removed: false } });

    expect(removedFolder.isRemoved()).toBe(true);
    expect(notRemovedFolder.isRemoved()).toBe(false);
  });

  it('When the the folder is removed, then the trashed check helper returns false', () => {
    // We use this way of reporting removed files, so we cannot avoid this situation
    const folder = newFolder({ attributes: { deleted: true, removed: true } });

    expect(folder.isTrashed()).toBe(false);
  });

  it('When the folder is removed, then the folder status returns as deleted', () => {
    const folder = newFolder({ attributes: { removed: true } });

    expect(folder.getFolderStatus()).toBe(FolderStatus.DELETED);
  });

  it('When the folder is deleted, then the folder status returns as trashed', () => {
    const folder = newFolder({ attributes: { deleted: true } });

    expect(folder.getFolderStatus()).toBe(FolderStatus.TRASHED);
  });

  it('When the folder is neither deleted or removed, then the folder status returns as exists', () => {
    const folder = newFolder({
      attributes: { removed: false, deleted: false },
    });

    expect(folder.getFolderStatus()).toBe(FolderStatus.EXISTS);
  });

  describe('getFilterByStatus', () => {
    it('When the status is EXISTS, it should return the correct filter for existing folders', () => {
      const filter = Folder.getFilterByStatus(FolderStatus.EXISTS);
      expect(filter).toEqual({ deleted: false, removed: false });
    });

    it('When the status is TRASHED, it should return the correct filter for trashed folders', () => {
      const filter = Folder.getFilterByStatus(FolderStatus.TRASHED);
      expect(filter).toEqual({ deleted: true, removed: false });
    });

    it('When the status is DELETED, it should return the correct filter for deleted folders', () => {
      const filter = Folder.getFilterByStatus(FolderStatus.DELETED);
      expect(filter).toEqual({ removed: true });
    });

    it('When the status is invalid, it should return an empty filter', () => {
      const filter = Folder.getFilterByStatus('INVALID_STATUS' as FolderStatus);
      expect(filter).toEqual({});
    });
  });
});
