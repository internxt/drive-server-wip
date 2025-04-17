import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';

import { TrashUseCases } from './trash.usecase';
import { File, FileAttributes } from '../file/file.domain';
import { User } from '../user/user.domain';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';

describe('Trash Use Cases', () => {
  let service: TrashUseCases,
    fileUseCases: FileUseCases,
    folderUseCases: FolderUseCases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrashUseCases],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    service = module.get<TrashUseCases>(TrashUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('delete items', () => {
    it.skip('should delete all items', async () => {
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
        'ca6b473d-221f-5832-a95e-8dd11f2af268',
        'fda03f0d-3006-5a86-b54b-8216da471fb0',
      ];

      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021,
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValue({} as File);
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValue({} as Folder);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementationOnce(() =>
          Promise.resolve({
            id: 2176796544,
            uuid: 'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
          }),
        );
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementation(() => Promise.resolve());

      await service.deleteItems(
        {} as User,
        filesIdToDelete as unknown as File[], // must be updated to be a list of files
        foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
      );

      expect(fileUseCases.getByFileIdAndUser).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(folderUseCases.getFolder).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
    });

    it.skip('should fail if a file is not found', async () => {
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValueOnce(null);
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems(
          {} as User,
          filesIdToDelete as unknown as File[], // must be updated to be a list of files
          filesIdToDelete as unknown as Folder[], // must be updated to be a list of folders );
        );
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.message).toBe(
          `file with id bbe6d386-e215-53a0-88ef-1e4c318e6ff9 not found`,
        );
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });

    it('shoul fail if a folder is not found', async () => {
      const error = Error('random error');
      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021,
      ];

      jest.spyOn(fileUseCases, 'getByFileIdAndUser');
      jest
        .spyOn(folderUseCases, 'getFolder')
        .mockImplementationOnce(() => Promise.resolve({} as Folder))
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve({} as Folder));
      jest.spyOn(fileUseCases, 'deleteFilePermanently');
      jest.spyOn(folderUseCases, 'deleteFolderPermanently');

      try {
        await service.deleteItems(
          {} as User,
          [],
          foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
        );
      } catch (err) {
        expect(err).toBeDefined();
      }

      expect(fileUseCases.deleteFilePermanently).not.toHaveBeenCalled();
      expect(folderUseCases.deleteFolderPermanently).not.toHaveBeenCalled();
    });

    it.skip('should try to delete all items even if a deletion fails', async () => {
      const error = new Error('unkown test error');
      const filesIdToDelete: Array<FileAttributes['fileId']> = [
        'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
        'ca6b473d-221f-5832-a95e-8dd11f2af268',
        'fda03f0d-3006-5a86-b54b-8216da471fb0',
        '38473164-6261-51af-8eb3-223c334986ce',
        '5e98661c-9b06-5b3f-ac3d-64e16caa1001',
      ];

      const foldersIdToDelete: Array<FolderAttributes['id']> = [
        2176796544, 505779655, 724413021, 2751197087, 3468856620,
      ];

      jest
        .spyOn(fileUseCases, 'getByFileIdAndUser')
        .mockResolvedValue({} as File);
      jest.spyOn(folderUseCases, 'getFolder').mockResolvedValue({} as Folder);
      jest
        .spyOn(fileUseCases, 'deleteFilePermanently')
        .mockImplementationOnce(() =>
          Promise.resolve({
            id: 2176796544,
            uuid: 'bbe6d386-e215-53a0-88ef-1e4c318e6ff9',
          }),
        )
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() =>
          Promise.resolve({
            id: 2751197087,
            uuid: '38473164-6261-51af-8eb3-223c334986ce',
          }),
        )
        .mockImplementationOnce(() => Promise.reject(error));
      jest
        .spyOn(folderUseCases, 'deleteFolderPermanently')
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(error));

      await service.deleteItems(
        {} as User,
        filesIdToDelete as unknown as File[], // must be updated to be a list of files
        foldersIdToDelete as unknown as Folder[], // must be updated to be a list of folders
      );

      expect(fileUseCases.getByFileIdAndUser).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(fileUseCases.deleteFilePermanently).toHaveBeenCalledTimes(
        filesIdToDelete.length,
      );
      expect(folderUseCases.getFolder).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
      expect(folderUseCases.deleteFolderPermanently).toHaveBeenCalledTimes(
        foldersIdToDelete.length,
      );
    });
  });
});
