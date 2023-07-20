import { Test, TestingModule } from '@nestjs/testing';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

describe('PrivateSharingUseCase', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;
  let userRespository: SequelizeUserRepository;
  let folderRespository: SequelizeFolderRepository;

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
      ],
    }).compile();

    privateSharingUseCase = module.get<PrivateSharingUseCase>(
      PrivateSharingUseCase,
    );
    privateSharingRespository = module.get<SequelizePrivateSharingRepository>(
      SequelizePrivateSharingRepository,
    );
    userRespository = module.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    folderRespository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
  });

  it('should be defined', () => {
    expect(privateSharingUseCase).toBeDefined();
    expect(privateSharingRespository).toBeDefined();
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
      const foundUser = { ...user, uuid: userUuid };
      const foundFolder = { ...folders[0], uuid: folderUuid };
      const foundPrivateFolder = { folderId: 1 };

      userRepositoryMock.findByUuid.mockResolvedValue(foundUser);
      privateSharingRepositoryMock.findById.mockImplementation(() =>
        Promise.resolve(foundPrivateFolder),
      );
      folderRepositoryMock.findByUuid.mockResolvedValue(foundFolder);
      folderRepositoryMock.isOwner.mockResolvedValue(true);

      await privateSharingUseCase.grantPrivileges(
        owner,
        userUuid,
        privateFolderId,
        roleUuid,
      );

      expect(userRespository.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(privateSharingRespository.findById).toHaveBeenCalledWith(
        privateFolderId,
      );
      expect(folderRespository.findByUuid).toHaveBeenCalledWith(
        foundPrivateFolder.folderId,
      );
      expect(
        privateSharingRespository.createPrivateFolderRole,
      ).toHaveBeenCalledWith(foundUser, foundFolder, roleUuid);
    });

    it('should throw an error if the owner is not the owner of the folder', async () => {
      const foundUser = { ...user, uuid: userUuid };
      const foundFolder = { ...folders[0], uuid: folderUuid };
      const foundPrivateFolder = { folderId: 1 };

      userRepositoryMock.findByUuid.mockResolvedValue(foundUser);
      privateSharingRepositoryMock.findById.mockResolvedValue(
        foundPrivateFolder,
      );
      folderRepositoryMock.findByUuid.mockResolvedValue(foundFolder);
      folderRepositoryMock.isOwner.mockResolvedValue(false);

      expect(
        privateSharingUseCase.grantPrivileges(
          owner,
          userUuid,
          privateFolderId,
          roleUuid,
        ),
      ).rejects.toThrow('You are not the owner of this folder');

      expect(userRepositoryMock.findByUuid).toHaveBeenCalledWith(userUuid);
      expect(privateSharingRepositoryMock.findById).toHaveBeenCalledWith(
        privateFolderId,
      );
      expect(folderRepositoryMock.findByUuid).toHaveBeenCalled();
      expect(folderRepositoryMock.isOwner).toHaveBeenCalled();
    });
  });
});
