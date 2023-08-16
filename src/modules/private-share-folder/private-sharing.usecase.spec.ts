import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';

import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import {
  FolderNotSharedError,
  FolderNotSharedWithUserError,
  InvalidOwnerError,
  OwnerCannotBeRemovedWithError,
  OwnerCannotBeSharedWithError,
  PrivateSharingUseCase,
  RoleNotFoundError,
  UserAlreadyHasRole,
  UserNotInvitedError,
} from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';
import {
  generateWithDefaultSecret,
  verifyWithDefaultSecret,
} from '../../lib/jwt';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../config/configuration';
import { ForbiddenException } from '@nestjs/common';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';

describe('Private Sharing Use Cases', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;
  let privateSharingFolderRolesRespository: PrivateSharingFolderRolesRepository;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userUseCases: UserUseCases;

  const userRepositoryMock = {
    findByUuid: jest.fn(),
  };

  const user = User.build({
    userId: 'JohnDoe userId',
    name: 'John',
    lastname: 'Doe',
    uuid: v4(),
    email: 'johnTwo@doe.com',
    username: 'johnTwo@doe.com',
    bridgeUser: 'johnTwo@doe.com',
    password: '',
    mnemonic: 'john doe mnemonic',
    referrer: v4(),
    referralCode: v4(),
    credit: 0,
    hKey: Buffer.from('john doe hKey'),
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    lastResend: new Date(),
    syncDate: new Date(),
    welcomePack: true,
    registerCompleted: true,
    id: 0,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    tempKey: '',
    avatar: '',
  });

  const invitedUser = User.build({
    userId: 'JohnDoe userId',
    name: 'John',
    lastname: 'Doe',
    uuid: v4(),
    email: 'johnTwo@doe.com',
    username: 'johnTwo@doe.com',
    bridgeUser: 'johnTwo@doe.com',
    password: '',
    mnemonic: 'john doe mnemonic',
    referrer: v4(),
    referralCode: v4(),
    credit: 0,
    hKey: Buffer.from('john doe hKey'),
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    lastResend: new Date(),
    syncDate: new Date(),
    welcomePack: true,
    registerCompleted: true,
    id: 1,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    tempKey: '',
    avatar: '',
  });

  const rootSharedFolder = Folder.build({
    id: 0,
    parentId: null,
    name: 'FolderTwo',
    bucket: 'bucketTwo',
    userId: user.id,
    uuid: v4(),
    plainName: 'FolderTwo',
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    removedAt: null,
    deletedAt: null,
  });

  const childOfRoot = Folder.build({
    id: 1,
    parentId: rootSharedFolder.id,
    name: 'child of root folder',
    bucket: 'bucketTwo',
    userId: user.id,
    uuid: v4(),
    plainName: 'child of root folder',
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    removedAt: null,
    deletedAt: null,
  });

  const childOfTheChildOfRoot = Folder.build({
    id: 2,
    parentId: childOfRoot.id,
    name: 'child of the child of the root folder',
    bucket: 'bucketTwo',
    userId: user.id,
    uuid: v4(),
    plainName: 'child of the child of the root folder',
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    removedAt: null,
    deletedAt: null,
  });

  function getChildrenOf(f: Folder) {
    return folders.filter((folder) => folder.parentId === f.id);
  }

  const folders: Folder[] = [
    rootSharedFolder,
    childOfRoot,
    childOfTheChildOfRoot,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV}`],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        PrivateSharingUseCase,
        {
          provide: SequelizePrivateSharingRepository,
          useValue: createMock<SequelizePrivateSharingRepository>(),
        },
        {
          provide: SequelizeUserRepository,
          useValue: userRepositoryMock,
        },
        {
          provide: PrivateSharingFolderRolesRepository,
          useValue: createMock<PrivateSharingFolderRolesRepository>(),
        },
        {
          provide: SequelizeFolderRepository,
          useValue: createMock<SequelizeFolderRepository>(),
        },
        {
          provide: FolderUseCases,
          useValue: createMock<FolderUseCases>(),
        },
        {
          provide: FileUseCases,
          useValue: createMock<FileUseCases>(),
        },
        {
          provide: UserUseCases,
          useValue: createMock<UserUseCases>(),
        },
      ],
    }).compile();

    privateSharingUseCase = module.get<PrivateSharingUseCase>(
      PrivateSharingUseCase,
    );
    privateSharingRespository = module.get<SequelizePrivateSharingRepository>(
      SequelizePrivateSharingRepository,
    );
    privateSharingFolderRolesRespository =
      module.get<PrivateSharingFolderRolesRepository>(
        PrivateSharingFolderRolesRepository,
      );
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    userUseCases = module.get<UserUseCases>(UserUseCases);
  });

  it('should be defined', () => {
    expect(privateSharingUseCase).toBeDefined();
    expect(privateSharingRespository).toBeDefined();
  });

  describe('Listing items on a private shared folder', () => {
    describe('When listing the items in the root of the private shared folder', () => {
      it('When you are the owner, then you should get the items', async () => {
        const folder = rootSharedFolder;
        const expectedFolders = getChildrenOf(folder);
        const expectedFolderFormatWithShared = expectedFolders.map((f) => {
          return {
            ...f,
            sharedWithMe: null,
            encryptionKey: null,
            dateShared: null,
          };
        });
        const expectedFiles = [];
        const getFolderByUuidSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(folder);

        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedFiles);

        const {
          folders: receivedFolders,
          files,
          token,
          credentials,
        } = await privateSharingUseCase.getItems(
          folder.uuid,
          null,
          user,
          0,
          10,
          [],
        );

        expect(getFolderByUuidSpy).toHaveBeenCalledWith(folder.uuid);
        expect(receivedFolders).toStrictEqual(expectedFolderFormatWithShared);
        expect(files).toStrictEqual(expectedFiles);
        expect(token).toStrictEqual('');
        expect(credentials).toStrictEqual({
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        });
      });

      it('When you are an invited user, then you should get the items', async () => {
        const folder = rootSharedFolder;
        const expectedFolders = getChildrenOf(folder);
        const expectedFolderFormatWithShared = expectedFolders.map((f) => {
          return {
            ...f,
            sharedWithMe: null,
            encryptionKey: null,
            dateShared: null,
          };
        });
        const expectedFiles = [];
        const getFolderByUuidSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(folder);

        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedFiles);
        const findRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(
            PrivateSharingFolderRole.build({
              id: v4(),
              folderId: rootSharedFolder.uuid,
              userId: invitedUser.uuid,
              roleId: v4(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          );
        const findPrivateFolderSharingSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderByFolderIdAndSharedWith',
          )
          .mockResolvedValue(
            PrivateSharingFolder.build({
              id: v4(),
              folderId: rootSharedFolder.uuid,
              encryptionKey: '',
              ownerId: user.uuid,
              folder: folder,
              sharedWith: invitedUser.uuid,
            }),
          );
        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(user);

        const {
          folders: receivedFolders,
          files,
          token,
          credentials,
        } = await privateSharingUseCase.getItems(
          folder.uuid,
          null,
          invitedUser,
          0,
          10,
          [],
        );

        expect(getFolderByUuidSpy).toHaveBeenCalledWith(folder.uuid);
        expect(receivedFolders).toStrictEqual(expectedFolderFormatWithShared);
        expect(findRoleSpy).toHaveBeenCalledWith(
          invitedUser.uuid,
          rootSharedFolder.uuid,
        );
        expect(findPrivateFolderSharingSpy).toHaveBeenCalledWith(
          rootSharedFolder.uuid,
          invitedUser.uuid,
        );
        expect(getUserSpy).toHaveBeenCalledWith(user.uuid);
        expect(files).toStrictEqual(expectedFiles);
        expect(() => verifyWithDefaultSecret(token)).not.toThrow();
        expect(credentials).toStrictEqual({
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        });
      });

      it('When you are not an invited user, then the items are not provided', async () => {
        const folder = rootSharedFolder;
        const expectedFolders = getChildrenOf(folder);
        const expectedFiles = [];

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedFiles);
        jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(null);

        await expect(
          privateSharingUseCase.getItems(
            folder.uuid,
            null,
            invitedUser,
            0,
            10,
            [],
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('When listing the items from a child folder of a private shared folder', () => {
      it('When you are the owner, then you should get the items', async () => {
        const folder = childOfRoot;
        const expectedFolders = getChildrenOf(folder);
        const expectedFolderFormatWithShared = expectedFolders.map((f) => {
          return {
            ...f,
            sharedWithMe: null,
            encryptionKey: null,
            dateShared: null,
          };
        });
        const expectedFiles = [];
        const getFolderByUuidSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(folder);

        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue([]);

        const {
          folders: receivedFolders,
          files,
          token,
          credentials,
        } = await privateSharingUseCase.getItems(
          folder.uuid,
          null,
          user,
          0,
          10,
          [],
        );

        expect(getFolderByUuidSpy).toHaveBeenCalledWith(folder.uuid);
        expect(receivedFolders).toStrictEqual(expectedFolderFormatWithShared);
        expect(files).toStrictEqual(expectedFiles);
        expect(token).toStrictEqual('');
        expect(credentials).toStrictEqual({
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        });
      });

      it('When you are an invited user, then you should get the items', async () => {
        const folder = childOfRoot;
        const expectedFolders = getChildrenOf(folder);
        const expectedFolderFormatWithShared = expectedFolders.map((f) => {
          return {
            ...f,
            sharedWithMe: null,
            encryptionKey: null,
            dateShared: null,
          };
        });
        const expectedFiles = [];
        const getFolderByUuidSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(folder);
        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedFiles);
        const findRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(
            PrivateSharingFolderRole.build({
              id: v4(),
              folderId: childOfRoot.uuid,
              userId: invitedUser.uuid,
              roleId: v4(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          );
        const findPrivateFolderSharingSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderByFolderIdAndSharedWith',
          )
          .mockResolvedValue(
            PrivateSharingFolder.build({
              id: v4(),
              folderId: rootSharedFolder.uuid,
              encryptionKey: '',
              folder: folder,
              ownerId: user.uuid,
              sharedWith: invitedUser.uuid,
            }),
          );
        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(user);

        const tokenFromTheLastCall = generateWithDefaultSecret(
          {
            sharedRootFolderId: rootSharedFolder.uuid,
            parentFolderId: rootSharedFolder.parentId,
            folder: {
              id: folder.parentId,
              uuid: v4(),
            },
            owner: {
              id: user.id,
              uuid: user.uuid,
            },
          },
          '1d',
        );

        const {
          folders: receivedFolders,
          files,
          token,
          credentials,
        } = await privateSharingUseCase.getItems(
          folder.uuid,
          tokenFromTheLastCall,
          invitedUser,
          0,
          10,
          [],
        );

        expect(getFolderByUuidSpy).toHaveBeenCalledWith(folder.uuid);
        expect(receivedFolders).toStrictEqual(expectedFolderFormatWithShared);
        expect(findRoleSpy).toHaveBeenCalledWith(
          invitedUser.uuid,
          rootSharedFolder.uuid,
        );
        expect(findPrivateFolderSharingSpy).toHaveBeenCalledWith(
          rootSharedFolder.uuid,
          invitedUser.uuid,
        );
        expect(getUserSpy).toHaveBeenCalledWith(user.uuid);
        expect(files).toStrictEqual(expectedFiles);
        expect(() => verifyWithDefaultSecret(token)).not.toThrow();
        expect(credentials).toStrictEqual({
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        });
      });

      it('When you are not an invited user, then the items are not provided', async () => {
        const folder = childOfRoot;
        const expectedFolders = getChildrenOf(folder);
        const expectedFiles = [];

        jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

        jest
          .spyOn(folderUseCases, 'getFolders')
          .mockResolvedValue(expectedFolders);
        jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(expectedFiles);
        jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(null);

        const tokenFromTheLastCall = generateWithDefaultSecret(
          {
            sharedRootFolderId: rootSharedFolder.uuid,
            parentFolderId: rootSharedFolder.parentId,
            folder: {
              id: folder.id,
              uuid: folder.uuid,
            },
            owner: {
              id: user.id,
              uuid: user.uuid,
            },
          },
          '1d',
        );

        await expect(
          privateSharingUseCase.getItems(
            folder.uuid,
            tokenFromTheLastCall,
            invitedUser,
            0,
            10,
            [],
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('Request private shared folder', () => {
    it('When retrieving private folders shared by a specific user', async () => {
      jest
        .spyOn(privateSharingRespository, 'findByOwner')
        .mockResolvedValue(folders);

      const offset = 0;
      const limit = 10;
      const order: [string, string][] = [['createdAt', 'DESC']];

      const result = await privateSharingUseCase.getSharedFoldersByOwner(
        user,
        offset,
        limit,
        order,
      );

      expect(result).toEqual(folders);
      expect(privateSharingRespository.findByOwner).toHaveBeenCalledWith(
        user.uuid,
        offset,
        limit,
        order,
      );
    });

    it('When retrieving private folders shared with a specific user', async () => {
      jest
        .spyOn(privateSharingRespository, 'findBySharedWith')
        .mockResolvedValue(folders);

      const offset = 0;
      const limit = 10;
      const order: [string, string][] = [['createdAt', 'DESC']];

      const result = await privateSharingUseCase.getSharedFoldersBySharedWith(
        user,
        offset,
        limit,
        order,
      );

      expect(result).toEqual(folders);
      expect(privateSharingRespository.findBySharedWith).toHaveBeenCalledWith(
        user.uuid,
        offset,
        limit,
        order,
      );
    });
  });

  describe('Managing roles over a private sharing', () => {
    const userUuid = v4();
    const privateFolderId = v4();
    const roleUuid = v4();
    const owner = user;

    describe('Creating roles', () => {
      it('When a role is created by the owner, then the invited user gets a role', async () => {
        const privateSharingFolder = PrivateSharingFolder.build({
          id: v4(),
          folderId: rootSharedFolder.uuid,
          encryptionKey: '',
          ownerId: owner.uuid,
          sharedWith: invitedUser.uuid,
          folder: rootSharedFolder,
        });

        const findByIdPrivateSharingSpy = jest
          .spyOn(privateSharingRespository, 'findById')
          .mockResolvedValue(privateSharingFolder);

        const createPrivateFolderRoleSpy = jest.spyOn(
          privateSharingRespository,
          'createPrivateFolderRole',
        );

        await privateSharingUseCase.grantPrivileges(
          owner,
          userUuid,
          privateFolderId,
          roleUuid,
        );

        expect(findByIdPrivateSharingSpy).toHaveBeenCalledWith(privateFolderId);
        expect(createPrivateFolderRoleSpy).toHaveBeenCalledWith(
          userUuid,
          privateSharingFolder.folderId,
          roleUuid,
        );
      });

      it('When a non-owner attempts to create a role, the creation is denied', async () => {
        const realOwnerId = v4();
        const nonOwner = User.build({
          ...owner,
          id: owner.id + 2,
        });
        const findByIdPrivateSharingSpy = jest
          .spyOn(privateSharingRespository, 'findById')
          .mockResolvedValue({
            folder: rootSharedFolder,
            ...PrivateSharingFolder.build({
              id: v4(),
              folderId: rootSharedFolder.uuid,
              encryptionKey: '',
              ownerId: realOwnerId,
              sharedWith: invitedUser.uuid,
            }),
          } as PrivateSharingFolder);

        await expect(
          privateSharingUseCase.grantPrivileges(
            nonOwner,
            userUuid,
            privateFolderId,
            roleUuid,
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(findByIdPrivateSharingSpy).toHaveBeenCalledWith(privateFolderId);
      });
    });

    describe('Updating roles', () => {
      it('When the owner updated the role of a user inside a shared folder, then the role is updated', async () => {
        const roleId = v4();
        const ownedFolder = rootSharedFolder;
        const owner = user;
        const privateFolderRole = PrivateSharingFolderRole.build({
          id: v4(),
          folderId: rootSharedFolder.uuid,
          userId: invitedUser.uuid,
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(invitedUser);

        const findRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(privateFolderRole);

        const getFolderSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(ownedFolder);

        const updatePrivateFolderRoleSpy = jest.spyOn(
          privateSharingRespository,
          'updatePrivateFolderRole',
        );

        await privateSharingUseCase.updateRole(
          owner,
          invitedUser.uuid,
          ownedFolder.uuid,
          roleId,
        );

        expect(getUserSpy).toHaveBeenCalledWith(invitedUser.uuid);
        expect(findRoleSpy).toHaveBeenCalledWith(
          invitedUser.uuid,
          ownedFolder.uuid,
        );
        expect(getFolderSpy).toHaveBeenCalledWith(privateFolderRole.folderId);
        expect(updatePrivateFolderRoleSpy).toHaveBeenCalledWith(
          privateFolderRole.id,
          roleId,
        );
      });

      it('When a non-owner attempts to update the role, the update is denied', async () => {
        const roleId = v4();
        const notOwnedFolder = Folder.build({
          ...rootSharedFolder,
          userId: owner.id + 1,
        });
        const privateFolderRole = PrivateSharingFolderRole.build({
          id: v4(),
          folderId: rootSharedFolder.uuid,
          userId: invitedUser.uuid,
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(invitedUser);

        const findRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(privateFolderRole);

        const getFolderSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(notOwnedFolder);

        await expect(
          privateSharingUseCase.updateRole(
            owner,
            invitedUser.uuid,
            notOwnedFolder.uuid,
            roleId,
          ),
        ).rejects.toThrow(InvalidOwnerError);

        expect(getUserSpy).toHaveBeenCalledWith(invitedUser.uuid);
        expect(findRoleSpy).toHaveBeenCalledWith(
          invitedUser.uuid,
          notOwnedFolder.uuid,
        );
        expect(getFolderSpy).toHaveBeenCalledWith(privateFolderRole.folderId);
      });

      it('When the invited user has no role in the folder, then the role is not updated', async () => {
        const folderId = v4();
        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(invitedUser);

        const findRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(null);

        await expect(
          privateSharingUseCase.updateRole(
            owner,
            invitedUser.uuid,
            folderId,
            v4(),
          ),
        ).rejects.toThrow(UserNotInvitedError);

        expect(getUserSpy).toHaveBeenCalledWith(invitedUser.uuid);
        expect(findRoleSpy).toHaveBeenCalledWith(invitedUser.uuid, folderId);
      });

      it('When trying to update a non-existent role then, the update is denied', async () => {
        const roleId = v4();
        const ownedFolder = rootSharedFolder;
        const owner = user;
        const privateFolderRole = PrivateSharingFolderRole.build({
          id: v4(),
          folderId: rootSharedFolder.uuid,
          userId: invitedUser.uuid,
          roleId: v4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const getUserSpy = jest
          .spyOn(userUseCases, 'getUser')
          .mockResolvedValue(invitedUser);

        const findPrivateRoleSpy = jest
          .spyOn(
            privateSharingRespository,
            'findPrivateFolderRoleByFolderIdAndUserId',
          )
          .mockResolvedValue(privateFolderRole);

        const getFolderSpy = jest
          .spyOn(folderUseCases, 'getByUuid')
          .mockResolvedValue(ownedFolder);

        jest
          .spyOn(privateSharingRespository, 'findRoleById')
          .mockResolvedValue(null);

        await expect(
          privateSharingUseCase.updateRole(
            owner,
            invitedUser.uuid,
            ownedFolder.uuid,
            roleId,
          ),
        ).rejects.toThrow(RoleNotFoundError);

        expect(getUserSpy).toHaveBeenCalledWith(invitedUser.uuid);
        expect(findPrivateRoleSpy).toHaveBeenCalledWith(
          invitedUser.uuid,
          ownedFolder.uuid,
        );
        expect(getFolderSpy).toHaveBeenCalledWith(privateFolderRole.folderId);
      });
    });
  });

  describe('Inviting users to join the a private sharing', () => {
    it('When the owner wants to share a folder privately then, it should be able to do so', async () => {
      const owner = user;
      const sharedWith = invitedUser;
      const roleId = v4();
      const folderToShare = Folder.build({
        ...rootSharedFolder,
        userId: owner.id,
      });
      const encryptionKey = 'encryptionKey';

      const getUserSpy = jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);

      const getFolderSpy = jest
        .spyOn(folderUseCases, 'getByUuid')
        .mockResolvedValue(folderToShare);

      const findRoleSpy = jest
        .spyOn(
          privateSharingRespository,
          'findPrivateFolderRoleByFolderIdAndUserId',
        )
        .mockResolvedValue(null);

      const createPrivateFolderSpy = jest
        .spyOn(privateSharingRespository, 'createPrivateFolder')
        .mockResolvedValue(
          PrivateSharingFolder.build({
            id: v4(),
            folderId: folderToShare.uuid,
            encryptionKey: '',
            ownerId: owner.uuid,
            sharedWith: sharedWith.uuid,
          }),
        );

      const createPrivateFolderRoleSpy = jest
        .spyOn(privateSharingRespository, 'createPrivateFolderRole')
        .mockImplementation();

      await privateSharingUseCase.createPrivateSharingFolder(
        owner,
        folderToShare.uuid,
        sharedWith.email,
        encryptionKey,
        roleId,
      );

      expect(getUserSpy).toHaveBeenCalledWith(sharedWith.email);
      expect(getFolderSpy).toHaveBeenCalledWith(folderToShare.uuid);
      expect(findRoleSpy).toHaveBeenCalledWith(
        sharedWith.uuid,
        folderToShare.uuid,
      );
      expect(createPrivateFolderSpy).toHaveBeenCalledWith(
        folderToShare.uuid,
        owner.uuid,
        sharedWith.uuid,
        encryptionKey,
      );
      expect(createPrivateFolderRoleSpy).toHaveBeenCalledWith(
        sharedWith.uuid,
        folderToShare.uuid,
        roleId,
      );
    });

    it('When a non-owner attempts to share a folder then, the share is denied', async () => {
      const owner = user;
      const notTheOwner = newUser();
      const sharedWith = invitedUser;
      const roleId = v4();
      const folderToShare = Folder.build({
        ...rootSharedFolder,
        userId: owner.id,
      });
      const encryptionKey = 'encryptionKey';

      const getUserSpy = jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);

      const getFolderSpy = jest
        .spyOn(folderUseCases, 'getByUuid')
        .mockResolvedValue(folderToShare);

      await expect(
        privateSharingUseCase.createPrivateSharingFolder(
          notTheOwner,
          folderToShare.uuid,
          sharedWith.email,
          encryptionKey,
          roleId,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(getUserSpy).toHaveBeenCalledWith(sharedWith.email);
      expect(getFolderSpy).toHaveBeenCalledWith(folderToShare.uuid);
    });

    it('When the invited user already has a role in the folder then, the role is not created', async () => {
      const owner = user;
      const sharedWith = invitedUser;
      const roleId = v4();
      const folderToShare = rootSharedFolder;
      const encryptionKey = 'encryptionKey';

      const getUserSpy = jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);

      const getFolderSpy = jest
        .spyOn(folderUseCases, 'getByUuid')
        .mockResolvedValue(folderToShare);

      const findRoleSpy = jest
        .spyOn(
          privateSharingRespository,
          'findPrivateFolderRoleByFolderIdAndUserId',
        )
        .mockResolvedValue(
          PrivateSharingFolderRole.build({
            id: v4(),
            folderId: folderToShare.uuid,
            userId: sharedWith.uuid,
            roleId: v4(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );

      await expect(
        privateSharingUseCase.createPrivateSharingFolder(
          owner,
          folderToShare.uuid,
          sharedWith.email,
          encryptionKey,
          roleId,
        ),
      ).rejects.toThrow(UserAlreadyHasRole);

      expect(getUserSpy).toHaveBeenCalledWith(sharedWith.email);
      expect(getFolderSpy).toHaveBeenCalledWith(folderToShare.uuid);
      expect(findRoleSpy).toHaveBeenCalledWith(
        sharedWith.uuid,
        folderToShare.uuid,
      );
    });

    it('When the owner shares the folder with itself then, the creation fails', async () => {
      const owner = user;
      const sharedWith = owner;
      const invatedUserEmail = 'email@email.com';
      const folderUuid = v4();
      const roleId = v4();
      const encryptionKey = 'encryptionKey';
      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);

      await expect(
        privateSharingUseCase.createPrivateSharingFolder(
          owner,
          folderUuid,
          invatedUserEmail,
          encryptionKey,
          roleId,
        ),
      ).rejects.toThrow(OwnerCannotBeSharedWithError);
    });
  });
  describe('User stops sharing a folder', () => {
    it('When user is not the owner, then then it should not be allowed to stop sharing', async () => {
      const owner = user;
      const folder = Folder.build({
        ...folders[0],
        userId: owner.id,
      });
      const otherUser = User.build({
        ...owner,
        id: owner.id + 1,
        uuid: v4(),
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

      await expect(
        privateSharingUseCase.stopSharing(folder.uuid, otherUser),
      ).rejects.toThrowError(InvalidOwnerError);
    });

    it('When user tries to stop sharing a folder that is not shared, then it should not be allowed to stop sharing', async () => {
      const owner = user;
      const empty = [];
      const folder = Folder.build({
        ...folders[0],
        userId: owner.id,
      });
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(privateSharingRespository, 'findByFolder')
        .mockResolvedValue(empty);
      await expect(
        privateSharingUseCase.stopSharing(folder.uuid, owner),
      ).rejects.toThrowError(FolderNotSharedError);
    });

    it('When owner stops sharing a folder, then it should be allowed to stop sharing', async () => {
      const owner = user;
      const folder = Folder.build({
        ...folders[0],
        userId: owner.id,
      });
      const otherUser = User.build({
        ...owner,
        id: owner.id + 1,
        uuid: v4(),
      });
      const privateSharingFolder = PrivateSharingFolder.build({
        id: v4(),
        folderId: folder.uuid,
        encryptionKey: '',
        ownerId: owner.uuid,
        sharedWith: otherUser.uuid,
      });
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(privateSharingRespository, 'findByFolder')
        .mockResolvedValue([privateSharingFolder]);
      const removeFolderRolesCompletlyMock = jest.spyOn(
        privateSharingFolderRolesRespository,
        'removeByFolder',
      );
      const stopSharingMock = jest.spyOn(
        privateSharingRespository,
        'removeByFolder',
      );
      await privateSharingUseCase.stopSharing(folder.uuid, owner);
      expect(removeFolderRolesCompletlyMock).toHaveBeenCalled();
      expect(stopSharingMock).toHaveBeenCalled();
    });
  });
  describe('Owner removes a user from a shared folder', () => {
    const userUuid = v4();

    it('When the user requesting the removal is not the owner then, it fails', async () => {
      const owner = newUser();
      const notTheOwner = newUser();
      const sharedWith = newUser();
      const folder = newFolder(owner);

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);

      await expect(
        privateSharingUseCase.removeSharedWith(
          folder.uuid,
          notTheOwner.uuid,
          sharedWith,
        ),
      ).rejects.toThrowError(InvalidOwnerError);
    });

    it('When the owner tries to remove its own sharing, then it should not be allowed to remove itself', async () => {
      const owner = newUser();
      const folder = newFolder(owner);

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      await expect(
        privateSharingUseCase.removeSharedWith(folder.uuid, owner.uuid, owner),
      ).rejects.toThrowError(OwnerCannotBeRemovedWithError);
    });

    it('When the owner tries to remove a user that is not invited to the folder then, it fails', async () => {
      const owner = newUser();
      const otherUser = newUser();
      const folder = newFolder(owner);
      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(privateSharingRespository, 'findByFolderAndSharedWith')
        .mockResolvedValue(null);
      await expect(
        privateSharingUseCase.removeSharedWith(
          folder.uuid,
          otherUser.uuid,
          owner,
        ),
      ).rejects.toThrowError(FolderNotSharedWithUserError);
    });

    it('When the owner removes a user which was previously invited then, it should work', async () => {
      const owner = user;
      const otherUser = newUser();
      const folder = newFolder(owner);

      const privateSharingFolder = PrivateSharingFolder.build({
        id: v4(),
        folderId: folder.uuid,
        encryptionKey: '',
        ownerId: owner.uuid,
        sharedWith: otherUser.uuid,
      });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(privateSharingRespository, 'findByFolderAndSharedWith')
        .mockResolvedValue(privateSharingFolder);

      const removeFolderRoleMock = jest.spyOn(
        privateSharingFolderRolesRespository,
        'removeByUser',
      );
      const removeSharedWithMock = jest.spyOn(
        privateSharingRespository,
        'removeBySharedWith',
      );

      await privateSharingUseCase.removeSharedWith(
        folder.uuid,
        userUuid,
        owner,
      );
      expect(removeFolderRoleMock).toHaveBeenCalled();
      expect(removeSharedWithMock).toHaveBeenCalled();
    });
  });

  function newUser(): User {
    return User.build({
      id: Math.random() * 999999,
      userId: '',
      name: 'John',
      lastname: 'Doe',
      uuid: v4(),
      email: '',
      username: '',
      bridgeUser: '',
      password: '',
      mnemonic: '',
      referrer: v4(),
      referralCode: v4(),
      credit: 0,
      hKey: Buffer.from(''),
      rootFolderId: 0,
      errorLoginCount: 0,
      isEmailActivitySended: 0,
      lastResend: new Date(),
      syncDate: new Date(),
      welcomePack: false,
      registerCompleted: false,
      secret_2FA: '',
      backupsBucket: '',
      sharedWorkspace: false,
      tempKey: '',
      avatar: '',
    });
  }

  function newFolder(owner?: User): Folder {
    return Folder.build({
      id: Math.random(),
      uuid: v4(),
      name: 'folder',
      parentId: 0,
      userId: owner?.id ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      bucket: '',
      plainName: '',
      encryptVersion: '03-aes',
      deleted: false,
      removed: false,
      deletedAt: undefined,
      removedAt: undefined,
    });
  }
});
