import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newFolder } from '../../../test/fixtures';
import { FileUseCases } from './file.usecase';
import { User } from '../user/user.domain';
import { File, FileStatus } from './file.domain';
import { FileController } from './file.controller';
import { FolderUseCases } from '../folder/folder.usecase';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
  let folderUseCases: FolderUseCases;
  let file: File;

  const userMocked = User.build({
    id: 1,
    userId: 'userId',
    name: 'User Owner',
    lastname: 'Lastname',
    email: 'fake@internxt.com',
    username: 'fake',
    bridgeUser: null,
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    referralCode: null,
    referrer: null,
    syncDate: new Date(),
    uuid: 'uuid',
    lastResend: new Date(),
    credit: null,
    welcomePack: true,
    registerCompleted: true,
    backupsBucket: 'bucket',
    sharedWorkspace: true,
    avatar: 'avatar',
    password: '',
    mnemonic: '',
    hKey: undefined,
    secret_2FA: '',
    tempKey: '',
    lastPasswordChangedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [FileUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    fileController = module.get<FileController>(FileController);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    file = newFile();
  });

  describe('move file', () => {
    it('When move file is requested with valid params, then the file is returned with its updated properties', async () => {
      const destinationFolder = newFolder();
      const expectedFile = newFile({
        attributes: {
          ...file,
          name: 'newencrypted-' + file.name,
          folderId: destinationFolder.id,
          folderUuid: destinationFolder.uuid,
          status: FileStatus.EXISTS,
        },
      });

      jest.spyOn(fileUseCases, 'moveFile').mockResolvedValue(expectedFile);

      const result = await fileController.moveFile(userMocked, file.uuid, {
        destinationFolder: destinationFolder.uuid,
      });
      expect(result).toEqual(expectedFile);
    });

    it('When move file is requested with invalid params, then it should throw an error', () => {
      expect(
        fileController.moveFile(userMocked, 'invaliduuid', {
          destinationFolder: v4(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(
        fileController.moveFile(userMocked, v4(), {
          destinationFolder: 'invaliduuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('get file by path', () => {
    it('When get file metadata by path is requested with a valid path, then the file is returned', async () => {
      const expectedFile = newFile();
      const filePath = Buffer.from('/test/file.png', 'binary').toString(
        'base64',
      );
      jest
        .spyOn(fileUseCases, 'getFilesByPathAndUser')
        .mockResolvedValue([expectedFile]);

      const result = await fileController.getFileMetaByPath(
        userMocked,
        filePath,
      );
      expect(result).toEqual({ file: expectedFile });
    });

    it('When get file metadata by path is requested with a valid path and multiple posibble files, then the file is returned', async () => {
      const firstAncestorFolder1 = newFolder({
        attributes: {
          name: 'test',
          plainName: 'test',
        },
      });
      const firstAncestorFolder2 = newFolder({
        attributes: {
          name: 'test2',
          plainName: 'test2',
        },
      });
      const possibleFolder1 = newFolder({
        attributes: {
          name: 'folder',
          plainName: 'folder',
          parent: firstAncestorFolder1,
          parentId: firstAncestorFolder1.id,
          parentUuid: firstAncestorFolder1.uuid,
        },
      });
      const possibleFolder2 = newFolder({
        attributes: {
          name: 'folder',
          plainName: 'folder',
          parent: firstAncestorFolder2,
          parentId: firstAncestorFolder2.id,
          parentUuid: firstAncestorFolder2.uuid,
        },
      });
      const possibleFile1 = newFile({
        attributes: {
          name: 'file',
          type: 'png',
          folder: possibleFolder1,
          folderId: possibleFolder1.id,
          folderUuid: possibleFolder1.uuid,
        },
      });
      const possibleFile2 = newFile({
        attributes: {
          name: 'file',
          type: 'png',
          folder: possibleFolder2,
          folderId: possibleFolder2.id,
          folderUuid: possibleFolder2.uuid,
        },
      });
      const completePath = `/${firstAncestorFolder1.name}/${possibleFolder1.name}/${possibleFile1.name}.${possibleFile1.type}`;
      const filePath = Buffer.from(completePath, 'binary').toString('base64');
      jest
        .spyOn(fileUseCases, 'getFilesByPathAndUser')
        .mockResolvedValue([possibleFile1, possibleFile2]);
      jest
        .spyOn(fileUseCases, 'getPathFirstFolder')
        .mockReturnValue(possibleFolder1.name);
      jest
        .spyOn(folderUseCases, 'getFolderAncestors')
        .mockResolvedValueOnce([newFolder(), possibleFolder2, newFolder()])
        .mockResolvedValueOnce([newFolder(), possibleFolder1, newFolder()]);

      const result = await fileController.getFileMetaByPath(
        userMocked,
        filePath,
      );
      expect(result).toEqual({ file: possibleFile1 });
    });

    it('When get file metadata by path is requested with a valid path that not exists, then it should throw a not found error', async () => {
      const filePath = Buffer.from('/test/file.png', 'binary').toString(
        'base64',
      );
      jest.spyOn(fileUseCases, 'getFilesByPathAndUser').mockResolvedValue([]);

      expect(
        fileController.getFileMetaByPath(userMocked, filePath),
      ).rejects.toThrow(NotFoundException);
    });

    it('When get file metadata by path is requested with an invalid path, then it should throw an error', () => {
      expect(
        fileController.getFileMetaByPath(userMocked, 'invalidpath'),
      ).rejects.toThrow(BadRequestException);

      expect(fileController.getFileMetaByPath(userMocked, '')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        fileController.getFileMetaByPath(userMocked, '/path/notBase64Encoded'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
