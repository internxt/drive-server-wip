import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newFolder } from '../../../test/fixtures';
import { FileUseCases } from './file.usecase';
import { User } from '../user/user.domain';
import { File, FileStatus } from './file.domain';
import { FileController } from './file.controller';

describe('FileController', () => {
  let fileController: FileController;
  let fileUseCases: FileUseCases;
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
});
