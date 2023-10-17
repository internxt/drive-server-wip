import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';

import { UserUseCases } from './user.usecase';
import { ShareUseCases } from '../share/share.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { User } from './user.domain';
import { SequelizeUserRepository } from './user.repository';
import { SequelizeSharedWorkspaceRepository } from '../../shared-workspace/shared-workspace.repository';
import { SequelizeReferralRepository } from './referrals.repository';
import { SequelizeUserReferralsRepository } from './user-referrals.repository';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { NotificationService } from '../../externals/notifications/notification.service';
import { PaymentsService } from '../../externals/payments/payments.service';
import { NewsletterService } from '../../externals/newsletter';
import { ConfigService } from '@nestjs/config';
import { SequelizeKeyServerRepository } from '../keyserver/key-server.repository';
import { Folder, FolderAttributes } from '../folder/folder.domain';
import { File, FileAttributes } from '../file/file.domain';
import { AvatarService } from '../../externals/avatar/avatar.service';

describe('User use cases', () => {
  let userUseCases: UserUseCases;
  let shareUseCases: ShareUseCases;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;

  const user = User.build({
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
  });

  beforeEach(async () => {
    const moduleRef = await createTestingModule();

    shareUseCases = moduleRef.get<ShareUseCases>(ShareUseCases);
    folderUseCases = moduleRef.get<FolderUseCases>(FolderUseCases);
    fileUseCases = moduleRef.get<FileUseCases>(FileUseCases);
    userUseCases = moduleRef.get<UserUseCases>(UserUseCases);
  });

  describe('Resetting a user', () => {
    it('When all options are false, then the reset does nothing', async () => {
      const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
      const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
      const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

      await userUseCases.resetUser(user, {
        deleteFiles: false,
        deleteFolders: false,
        deleteShares: false,
      });

      expect(deleteSharesSpy).not.toBeCalled();
      expect(deleteFoldersSpy).not.toBeCalled();
      expect(deleteFilesSpy).not.toBeCalled();
    });

    describe('When options are provided', () => {
      it('When delete shares is true, then the shares are deleted', async () => {
        const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
        const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
        const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');

        await userUseCases.resetUser(user, {
          deleteFiles: false,
          deleteFolders: false,
          deleteShares: true,
        });

        expect(deleteSharesSpy).toBeCalledWith(user);
        expect(deleteFoldersSpy).not.toBeCalled();
        expect(deleteFilesSpy).not.toBeCalled();
      });

      describe('When resources do not exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
          });

          expect(getFoldersSpy).toBeCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).toBeCalledWith(user, folders);
          expect(deleteFilesSpy).not.toBeCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
          });

          expect(getFilesSpy).toBeCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).not.toBeCalled();
          expect(deleteFilesSpy).toBeCalledWith(user, files);
        });
      });

      describe('When resources exist', () => {
        it('When delete folders is true, then the folders are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFoldersSpy = jest.spyOn(folderUseCases, 'getFolders');
          const folders = [Folder.build({} as FolderAttributes)];
          getFoldersSpy.mockReturnValue(Promise.resolve(folders));

          await userUseCases.resetUser(user, {
            deleteFiles: false,
            deleteFolders: true,
            deleteShares: false,
          });

          expect(getFoldersSpy).toBeCalledWith(
            user.id,
            { parentId: user.rootFolderId, removed: false },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).toBeCalledWith(user, folders);
          expect(deleteFilesSpy).not.toBeCalled();
        });

        it('When delete files is true, then the files are deleted', async () => {
          const deleteSharesSpy = jest.spyOn(shareUseCases, 'deleteByUser');
          const deleteFoldersSpy = jest.spyOn(folderUseCases, 'deleteByUser');
          const deleteFilesSpy = jest.spyOn(fileUseCases, 'deleteByUser');
          const getFilesSpy = jest.spyOn(fileUseCases, 'getFilesNotDeleted');
          const files = [File.build({} as FileAttributes)];
          getFilesSpy.mockReturnValue(Promise.resolve(files));

          await userUseCases.resetUser(user, {
            deleteFiles: true,
            deleteFolders: false,
            deleteShares: false,
          });

          expect(getFilesSpy).toBeCalledWith(
            user.id,
            { folderId: user.rootFolderId },
            {
              limit: 50,
              offset: 0,
            },
          );
          expect(deleteSharesSpy).not.toBeCalled();
          expect(deleteFoldersSpy).not.toBeCalled();
          expect(deleteFilesSpy).toBeCalledWith(user, files);
        });
      });
    });
  });
});

const createTestingModule = (): Promise<TestingModule> => {
  return Test.createTestingModule({
    controllers: [],
    providers: [
      {
        provide: SequelizeUserRepository,
        useValue: createMock<SequelizeUserRepository>(),
      },
      {
        provide: SequelizeSharedWorkspaceRepository,
        useValue: createMock<SequelizeSharedWorkspaceRepository>(),
      },
      {
        provide: SequelizeReferralRepository,
        useValue: createMock<SequelizeReferralRepository>(),
      },
      {
        provide: SequelizeUserReferralsRepository,
        useValue: createMock<SequelizeUserReferralsRepository>(),
      },
      {
        provide: FileUseCases,
        useValue: createMock<FileUseCases>(),
      },
      {
        provide: FolderUseCases,
        useValue: createMock<FolderUseCases>(),
      },
      {
        provide: ShareUseCases,
        useValue: createMock<ShareUseCases>(),
      },
      {
        provide: ConfigService,
        useValue: createMock<ConfigService>(),
      },
      {
        provide: CryptoService,
        useValue: createMock<CryptoService>(),
      },
      {
        provide: BridgeService,
        useValue: createMock<BridgeService>(),
      },
      {
        provide: NotificationService,
        useValue: createMock<NotificationService>(),
      },
      {
        provide: PaymentsService,
        useValue: createMock<PaymentsService>(),
      },
      {
        provide: NewsletterService,
        useValue: createMock<NewsletterService>(),
      },
      {
        provide: SequelizeKeyServerRepository,
        useValue: createMock<SequelizeKeyServerRepository>(),
      },
      {
        provide: AvatarService,
        useValue: createMock<AvatarService>(),
      },
      UserUseCases,
    ],
  }).compile();
};
