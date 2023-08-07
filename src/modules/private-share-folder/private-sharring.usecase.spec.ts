import { Test, TestingModule } from '@nestjs/testing';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import {
  FolderNotSharedError,
  InvalidOwnerError,
  PrivateSharingUseCase,
  UserNotInSharedFolder,
} from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';
import { PrivateSharingFolder } from './private-sharing-folder.domain';

describe('PrivateSharingUseCase', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;
  let privateSharingFolderRolesRespository: PrivateSharingFolderRolesRepository;

  const userRepositoryMock = {
    findByUuid: jest.fn(),
  };

  const folderRepositoryMock = {
    findByUuid: jest.fn(),
    isOwner: jest.fn(),
  };

  const privateSharingRepositoryMock = {
    findByOwner: jest.fn(),
    findBySharedWith: jest.fn(),
    findById: jest.fn(),
    createPrivateFolderRole: jest.fn(),
    removeByFolderUuid: jest.fn(),
    removeBySharedWith: jest.fn(),
    findByFolder: jest.fn(),
    findByFolderAndSharedWith: jest.fn(),
  };

  const folderRolesRepositoryMock = {
    removeByFolder: jest.fn(),
    removeByUser: jest.fn(),
    findByFolder: jest.fn(),
    findByFolderAndUser: jest.fn(),
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

  const folders: Folder[] = [
    Folder.build({
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
    }),
  ];

  const folerRoles: PrivateSharingFolderRole[] = [
    PrivateSharingFolderRole.build({
      id: v4(),
      folderId: v4(),
      userId: v4(),
      roleId: v4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  const sharingResult: PrivateSharingFolder[] = [
    PrivateSharingFolder.build({
      id: v4(),
      folderId: v4(),
      ownerId: v4(),
      sharedWith: v4(),
      encryptionKey: v4(),
    }),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivateSharingUseCase,
        {
          provide: SequelizePrivateSharingRepository,
          useValue: privateSharingRepositoryMock,
        },
        {
          provide: SequelizeUserRepository,
          useValue: userRepositoryMock,
        },
        {
          provide: SequelizeFolderRepository,
          useValue: folderRepositoryMock,
        },
        {
          provide: PrivateSharingFolderRolesRepository,
          useValue: folderRolesRepositoryMock,
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
  });

  it('should be defined', () => {
    expect(privateSharingUseCase).toBeDefined();
    expect(privateSharingRespository).toBeDefined();
    expect(privateSharingFolderRolesRespository).toBeDefined();
  });

  describe('getSharedFoldersByOwner', () => {
    const userUuid = v4();
    const privateFolderId = v4();
    const roleUuid = v4();
    const owner = user;
    const folderUuid = v4();

    it('should return the folders shared by a specific user', async () => {
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

    it('should return the folders shared with a specific user', async () => {
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

    it('should grant privileges if the owner is indeed the owner of the folder', async () => {
      const folderId = v4();
      const foundPrivateFolder = {
        folderId: folderId,
        folder: { userId: owner.id, uuid: folderId },
      };

      privateSharingRepositoryMock.findById.mockImplementation(() =>
        Promise.resolve(foundPrivateFolder),
      );

      await privateSharingUseCase.grantPrivileges(
        owner,
        userUuid,
        privateFolderId,
        roleUuid,
      );

      expect(privateSharingRespository.findById).toHaveBeenCalledWith(
        privateFolderId,
      );
      expect(
        privateSharingRespository.createPrivateFolderRole,
      ).toHaveBeenCalledWith(userUuid, foundPrivateFolder.folderId, roleUuid);
    });

    it('should throw an error if the owner is not the owner of the folder', async () => {
      const foundPrivateFolder = {
        folderId: 1,
        folder: { userId: owner.id + 1 },
      }; // Un usuario diferente

      privateSharingRepositoryMock.findById.mockResolvedValue(
        foundPrivateFolder,
      );

      await expect(
        privateSharingUseCase.grantPrivileges(
          owner,
          userUuid,
          privateFolderId,
          roleUuid,
        ),
      ).rejects.toThrow(InvalidOwnerError);

      expect(privateSharingRepositoryMock.findById).toHaveBeenCalledWith(
        privateFolderId,
      );
    });
  });

  describe('stopSharing', () => {
    const folderUuid = v4();

    it('should throw folder not shared', async () => {
      const empty = [];
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolder')
        .mockResolvedValue(empty);
      jest
        .spyOn(privateSharingRespository, 'findByFolder')
        .mockResolvedValue(empty);
      await expect(
        privateSharingUseCase.stopSharing(folderUuid),
      ).rejects.toThrowError(new FolderNotSharedError());
    });

    it('should return stoped in false', async () => {
      const resultExpected = { stoped: false };
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolder')
        .mockResolvedValue(folerRoles);
      jest
        .spyOn(privateSharingRespository, 'findByFolder')
        .mockResolvedValue(sharingResult);
      jest
        .spyOn(privateSharingFolderRolesRespository, 'removeByFolder')
        .mockResolvedValue(0);
      jest
        .spyOn(privateSharingRespository, 'removeByFolderUuid')
        .mockResolvedValue(0);

      await expect(
        privateSharingUseCase.stopSharing(folderUuid),
      ).resolves.toEqual(resultExpected);
    });

    it('should stop successfully', async () => {
      const resultExpected = { stoped: true };
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolder')
        .mockResolvedValue(folerRoles);
      jest
        .spyOn(privateSharingRespository, 'findByFolder')
        .mockResolvedValue(sharingResult);
      jest
        .spyOn(privateSharingFolderRolesRespository, 'removeByFolder')
        .mockResolvedValue(1);
      jest
        .spyOn(privateSharingRespository, 'removeByFolderUuid')
        .mockResolvedValue(1);

      await expect(
        privateSharingUseCase.stopSharing(folderUuid),
      ).resolves.toEqual(resultExpected);
    });
  });

  describe('removeUserSharing', () => {
    const userUuid = v4();
    const folderUuid = v4();

    it('should throw user is not in shared folder', async () => {
      const empty = [];
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolderAndUser')
        .mockResolvedValue(empty);
      jest
        .spyOn(privateSharingRespository, 'findByFolderAndSharedWith')
        .mockResolvedValue(empty);
      await expect(
        privateSharingUseCase.removeUserShared(folderUuid, userUuid),
      ).rejects.toThrowError(new UserNotInSharedFolder());
    });

    it('should return removed in false', async () => {
      const resultExpected = { removed: false };
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolderAndUser')
        .mockResolvedValue(folerRoles);
      jest
        .spyOn(privateSharingRespository, 'findByFolderAndSharedWith')
        .mockResolvedValue(sharingResult);
      jest
        .spyOn(privateSharingFolderRolesRespository, 'removeByUser')
        .mockResolvedValue(0);
      jest
        .spyOn(privateSharingRespository, 'removeBySharedWith')
        .mockResolvedValue(0);

      await expect(
        privateSharingUseCase.removeUserShared(folderUuid, userUuid),
      ).resolves.toEqual(resultExpected);
    });

    it('should remove successfully', async () => {
      const resultExpected = { removed: true };
      jest
        .spyOn(privateSharingFolderRolesRespository, 'findByFolderAndUser')
        .mockResolvedValue(folerRoles);
      jest
        .spyOn(privateSharingRespository, 'findByFolderAndSharedWith')
        .mockResolvedValue(sharingResult);
      jest
        .spyOn(privateSharingFolderRolesRespository, 'removeByUser')
        .mockResolvedValue(1);
      jest
        .spyOn(privateSharingRespository, 'removeBySharedWith')
        .mockResolvedValue(1);

      await expect(
        privateSharingUseCase.removeUserShared(folderUuid, userUuid),
      ).resolves.toEqual(resultExpected);
    });
  });
});
