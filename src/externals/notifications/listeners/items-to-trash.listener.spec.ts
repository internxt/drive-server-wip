import { Folder, FolderOptions } from '../../../modules/folder/folder.domain';
import { File } from '../../../modules/file/file.domain';
import { FileUseCases } from '../../../modules/file/file.usecase';
import { FolderUseCases } from '../../../modules/folder/folder.usecase';
import { ItemsToTrashEvent } from '../events/items-to-trash.event';
import { ItemToTrashListener } from './items-to-trash.listener';

describe('ItemToTrashListener', () => {
  let folderUseCases: FolderUseCases;
  let filesUseCases: FileUseCases;
  let service: ItemToTrashListener;

  beforeEach(async () => {
    folderUseCases = {
      getFolder: () => '',
      updateFolderUpdatedAt: () => '',
    } as unknown as FolderUseCases;
    filesUseCases = {
      getFileByFildeId: () => '',
    } as unknown as FileUseCases;

    service = new ItemToTrashListener(filesUseCases, folderUseCases);
  });

  describe('Handle Items Trashed', () => {
    const file1 = File.build({
      id: 1303581,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 350627,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const file2 = File.build({
      id: 11159,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 82815,
      encryptVersion: '',
      deleted: true,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const file3 = File.build({
      id: 14270,
      fileId: '',
      name: '',
      type: '',
      size: null,
      bucket: '',
      folderId: 578977,
      encryptVersion: '',
      deleted: false,
      deletedAt: new Date(),
      userId: 1,
      modificationTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const folderA = Folder.build({
      id: 90,
      parentId: 543966,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const folderB = Folder.build({
      id: 63491,
      parentId: 18075,
      name: 'name',
      bucket: 'bucket',
      userId: 1,
      encryptVersion: '03-aes',
      deleted: false,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let getFileByFildeId: jest.SpyInstance<Promise<File>, [fileId: string]>;
    let getFolder: jest.SpyInstance<Promise<Folder>, [number, FolderOptions?]>;
    let updateFolderUpdatedAt: jest.SpyInstance<
      Promise<void>,
      [folderId: number]
    >;

    beforeEach(() => {
      getFileByFildeId = jest.spyOn(filesUseCases, 'getFileByFildeId');
      getFolder = jest.spyOn(folderUseCases, 'getFolder');
      updateFolderUpdatedAt = jest.spyOn(
        folderUseCases,
        'updateFolderUpdatedAt',
      );
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('updates all the folders from the files', async () => {
      const items = [
        { type: 'file', id: file1.id },
        { type: 'file', id: file2.id },
        { type: 'file', id: file3.id },
      ];

      const event = new ItemsToTrashEvent(
        items,
        'test@internxt.com',
        'clientId',
      );

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file1))
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      await service.handleItemsTrashed(event);

      expect(getFolder).not.toBeCalled();
      expect(updateFolderUpdatedAt).toHaveBeenCalledTimes(3);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file1.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file2.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file3.folderId);
    });

    it('updates all the folders parents from folders', async () => {
      const event = new ItemsToTrashEvent(
        [
          { type: 'folder', id: folderA.id.toString() },
          { type: 'folder', id: folderB.id.toString() },
        ],
        'test@internxt.com',
        'clientId',
      );

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      await service.handleItemsTrashed(event);

      expect(getFileByFildeId).not.toBeCalled();
      expect(updateFolderUpdatedAt).toHaveBeenCalledTimes(2);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderA.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderB.parentId);
    });

    it('updates all the folder for files and folders', async () => {
      const event = new ItemsToTrashEvent(
        [
          { type: 'folder', id: folderA.id.toString() },
          { type: 'file', id: file1.id },
          { type: 'folder', id: folderB.id.toString() },
          { type: 'file', id: file3.id },
          { type: 'file', id: file2.id },
        ],
        'test@internxt.com',
        'clientId',
      );

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file1))
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      await service.handleItemsTrashed(event);

      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderA.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(folderB.parentId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file1.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file2.folderId);
      expect(updateFolderUpdatedAt).toHaveBeenCalledWith(file3.folderId);
    });

    it('does not fails when a file is not found', async () => {
      const event = new ItemsToTrashEvent(
        [{ type: 'file', id: file1.id }],
        'test@internxt.com',
        'clientId',
      );

      getFileByFildeId.mockImplementationOnce(() => Promise.reject());

      try {
        await service.handleItemsTrashed(event);
      } catch (error) {
        expect(error).not.toBeDefined();
      }

      expect(updateFolderUpdatedAt).not.toBeCalled();
    });

    it('does not fails when a folder is not found', async () => {
      const event = new ItemsToTrashEvent(
        [{ type: 'folder', id: folderA.id.toString() }],
        'test@internxt.com',
        'clientId',
      );

      getFolder.mockImplementationOnce(() => Promise.reject());

      try {
        await service.handleItemsTrashed(event);
      } catch (error) {
        expect(error).not.toBeDefined();
      }

      expect(updateFolderUpdatedAt).not.toBeCalled();
    });

    it('does not fail if a folder could not be updated', async () => {
      const event = new ItemsToTrashEvent(
        [
          { type: 'folder', id: folderA.id.toString() },
          { type: 'file', id: file3.id },
          { type: 'folder', id: folderB.id.toString() },
          { type: 'file', id: file2.id },
        ],
        'test@internxt.com',
        'clientId',
      );

      getFileByFildeId
        .mockImplementationOnce(() => Promise.resolve(file2))
        .mockImplementationOnce(() => Promise.resolve(file3));

      getFolder
        .mockImplementationOnce(() => Promise.resolve(folderA))
        .mockImplementationOnce(() => Promise.resolve(folderB));

      updateFolderUpdatedAt.mockImplementation(() => Promise.reject());

      try {
        await service.handleItemsTrashed(event);
      } catch (error) {
        expect(error).not.toBeDefined();
      }
    });
  });
});
