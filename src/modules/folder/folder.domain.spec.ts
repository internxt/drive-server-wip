import { newFolder } from '../../../test/fixtures';

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
});
