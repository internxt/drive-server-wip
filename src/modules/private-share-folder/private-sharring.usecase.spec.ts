import { Test, TestingModule } from '@nestjs/testing';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import {
  InvalidOwnerError,
  PrivateSharingUseCase,
} from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';
import { SequelizeUserRepository } from '../user/user.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';

describe('Private sharing folder use cases', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;
  let folderRespository: SequelizeFolderRepository;

  const userRepositoryMock = {
    findByUuid: jest.fn(),
  };

  const folderRepositoryMock = {
    findByUuid: jest.fn(),
  };

  const privateSharingRepositoryMock = {
    findByOwner: jest.fn(),
    findBySharedWith: jest.fn(),
    findById: jest.fn(),
    createPrivateFolderRole: jest.fn(),
    findPrivateFolderRoleById: jest.fn(),
    updatePrivateFolderRole: jest.fn(),
    findPrivateFolderRoleByFolderUuidAndUserUuid: jest.fn(),
    findRoleById: jest.fn(),
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
    folderRespository = module.get<SequelizeFolderRepository>(
      SequelizeFolderRepository,
    );
  });

  it('should be defined', () => {
    expect(privateSharingUseCase).toBeDefined();
    expect(privateSharingRespository).toBeDefined();
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

  describe('Manage private shared folder roles', () => {
    const userUuid = v4();
    const privateFolderId = v4();
    const roleUuid = v4();
    const owner = user;

    it('When privileges are granted by the owner, then the invited user gets role', async () => {
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

    it('When a non-owner attempts to grant privileges, the invited user doesnt receive roles', async () => {
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

    it('When the role is updated by the owner, the invited user updates their role', async () => {
      const roleId = v4();
      const owner = user;
      const invitedUserId = v4();
      const folderUuid = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid };
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderUuidAndUserUuid.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      folderRepositoryMock.findByUuid.mockResolvedValue(foundFolder);
      userRepositoryMock.findByUuid.mockResolvedValue(invitedUserId);

      await privateSharingUseCase.updateRole(
        owner,
        invitedUserId,
        folderUuid,
        roleId,
      );

      expect(folderRepositoryMock.findByUuid).toHaveBeenCalledWith(
        foundPrivateFolderRole.folderId,
      );
      expect(
        privateSharingRepositoryMock.updatePrivateFolderRole,
      ).toHaveBeenCalledWith(foundPrivateFolderRole, roleId);
    });

    it('When a non-owner attempts to update the role, the invited user doesnt update their role.', async () => {
      const roleId = v4();
      const owner = { ...user, id: user.id + 1 } as User;
      const folderUuid = v4();
      const invitedUserId = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid };
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderUuidAndUserUuid.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      folderRepositoryMock.findByUuid.mockResolvedValue(foundFolder);
      userRepositoryMock.findByUuid.mockResolvedValue(invitedUserId);

      expect(
        privateSharingUseCase.updateRole(
          owner,
          invitedUserId,
          folderUuid,
          roleId,
        ),
      ).rejects.toThrow('You are not the owner of this folder');

      expect(folderRepositoryMock.findByUuid).toHaveBeenCalled();
    });
  });
});
