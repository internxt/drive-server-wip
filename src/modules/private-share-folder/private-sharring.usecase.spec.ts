import { Test, TestingModule } from '@nestjs/testing';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import {
  InvalidOwnerError,
  OwnerCannotBeSharedError,
  PrivateSharingUseCase,
  RoleNotFoundError,
  UserAlreadyHasRole,
  UserNotInvitedError,
} from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { createMock } from '@golevelup/ts-jest';
import { PrivateSharingFolder } from './private-sharing-folder.domain';
import { PrivateSharingFolderModel } from './private-sharing-folder.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';

describe('Private sharing folder use cases', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;
  let folderUseCases: FolderUseCases;
  let userUseCases: UserUseCases;

  const privateSharingRepositoryMock = {
    findByOwner: jest.fn(),
    findBySharedWith: jest.fn(),
    findById: jest.fn(),
    createPrivateFolderRole: jest.fn(),
    findPrivateFolderRoleById: jest.fn(),
    updatePrivateFolderRole: jest.fn(),
    findPrivateFolderRoleByFolderIdAndUserId: jest.fn(),
    findRoleById: jest.fn(),
    createPrivateFolder: jest.fn(),
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

  const privateSharingFolder = PrivateSharingFolder.build({
    id: v4(),
    folderId: v4(),
    ownerId: v4(),
    sharedWith: v4(),
    encryptionKey: '',
  });

  const privateSharingFolderRole = PrivateSharingFolderRole.build({
    id: v4(),
    folderId: v4(),
    userId: v4(),
    roleId: v4(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivateSharingUseCase,
        {
          provide: SequelizePrivateSharingRepository,
          useValue: privateSharingRepositoryMock,
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
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    userUseCases = module.get<UserUseCases>(UserUseCases);
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
      }; // another user

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
      const foundFolder = { ...folders[0], uuid: folderUuid } as Folder;
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderIdAndUserId.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      const getFolderSpy = jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);
      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

      await privateSharingUseCase.updateRole(
        owner,
        invitedUserId,
        folderUuid,
        roleId,
      );

      expect(getFolderSpy).toHaveBeenCalledWith(
        foundPrivateFolderRole.folderId,
      );
      expect(
        privateSharingRepositoryMock.updatePrivateFolderRole,
      ).toHaveBeenCalledWith(foundPrivateFolderRole.id, roleId);
    });

    it('When a non-owner attempts to update the role, the invited user doesnt update their role.', async () => {
      const roleId = v4();
      const owner = { ...user, id: user.id + 1 } as User;
      const folderUuid = v4();
      const invitedUserId = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid } as Folder;
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderIdAndUserId.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      const getFolderSpy = jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);
      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

      await expect(
        privateSharingUseCase.updateRole(
          owner,
          invitedUserId,
          folderUuid,
          roleId,
        ),
      ).rejects.toThrow('You are not the owner of this folder');

      expect(getFolderSpy).toHaveBeenCalled();
    });

    it('When the user has no role in the folder, the user should not be able to update the role', async () => {
      const roleId = v4();
      const owner = user;
      const invitedUserId = v4();
      const folderUuid = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid } as Folder;
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderIdAndUserId.mockResolvedValue(
        null,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);
      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

      expect(
        privateSharingUseCase.updateRole(
          owner,
          invitedUserId,
          folderUuid,
          roleId,
        ),
      ).rejects.toThrow(UserNotInvitedError);
    });

    it('When the user is not the owner of the folder, it should not allow to update the role', async () => {
      const roleId = v4();
      const owner = user;
      const invitedUserId = v4();
      const folderUuid = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid };
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };
      const folderWithDifferentOwner = {
        ...foundFolder,
        userId: owner.id + 1,
      } as Folder;
      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderIdAndUserId.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue({
        id: roleId,
      });
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(folderWithDifferentOwner);
      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

      expect(
        privateSharingUseCase.updateRole(
          owner,
          invitedUserId,
          folderUuid,
          roleId,
        ),
      ).rejects.toThrow(InvalidOwnerError);
    });

    it('When trying to update a non-existent role then it should not allow the update', async () => {
      const roleId = v4();
      const owner = user;
      const invitedUserId = v4();
      const folderUuid = v4();
      const foundFolder = { ...folders[0], uuid: folderUuid } as Folder;
      const foundPrivateFolderRole = { id: 1, folderId: foundFolder.id };

      privateSharingRepositoryMock.findPrivateFolderRoleById.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findPrivateFolderRoleByFolderIdAndUserId.mockResolvedValue(
        foundPrivateFolderRole,
      );
      privateSharingRepositoryMock.findRoleById.mockResolvedValue(null);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);

      jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
      expect(
        privateSharingUseCase.updateRole(
          owner,
          invitedUserId,
          folderUuid,
          roleId,
        ),
      ).rejects.toThrow(RoleNotFoundError);
    });
  });

  describe('When user shares a folder', () => {
    it('When the user is the owner of the folder, then it should be able to share the folder', async () => {
      const owner = user;
      const sharedWith = { ...user, id: user.id + 1 } as User;
      const invatedUserEmail = 'email@email.com';
      const folderUuid = v4();
      const foundFolder = {
        ...folders[0],
        uuid: folderUuid,
        userId: owner.id,
      } as Folder;
      const encryptionKey = 'encryptionKey';
      const privateSharingFolderCustom = {
        ...privateSharingFolder,
        encryptionKey,
      };
      const createPrivateFolderMock = jest
        .spyOn(privateSharingRespository, 'createPrivateFolder')
        .mockResolvedValue(privateSharingFolderCustom);
      jest
        .spyOn(
          privateSharingRespository,
          'findPrivateFolderRoleByFolderIdAndUserId',
        )
        .mockResolvedValue(null);

      const getFolderMock = jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);
      const getUserByUsernameMock = jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);
      await privateSharingUseCase.createPrivateSharingFolder(
        owner,
        folderUuid,
        invatedUserEmail,
        encryptionKey,
      );
      expect(createPrivateFolderMock).toBeCalledWith(
        folderUuid,
        owner.uuid,
        sharedWith.uuid,
        encryptionKey,
      );
      expect(getFolderMock).toBeCalled();
      expect(getUserByUsernameMock).toBeCalled();
    });

    it('When the user is the owner of the folder, then should allow granting privileges to the guest user to the folder', async () => {
      const owner = user;
      const roleId = v4();
      const encryptionKey = 'encryptionKey';
      const privateSharingFolderCustom = {
        ...privateSharingFolder,
        encryptionKey,
        folder: folders[0],
      };
      const findPrivateSharingMock =
        privateSharingRepositoryMock.findById.mockResolvedValue(
          privateSharingFolderCustom,
        );
      const createPrivateRolMock =
        privateSharingRepositoryMock.createPrivateFolderRole;

      await privateSharingUseCase.grantPrivileges(
        owner,
        privateSharingFolderCustom.sharedWith,
        privateSharingFolderCustom.id,
        roleId,
      );
      expect(findPrivateSharingMock).toBeCalled();
      expect(createPrivateRolMock).toBeCalledWith(
        privateSharingFolderCustom.sharedWith,
        privateSharingFolderCustom.folder.uuid,
        roleId,
      );
    });

    it('When a non-owner attempts to share a folder, then should not allow folder sharing', async () => {
      const owner = user;
      const sharedWith = { ...user, id: user.id + 1 } as User;
      const invatedUserEmail = 'email@email.com';
      const folderUuid = v4();
      const foundFolder = {
        ...folders[0],
        uuid: folderUuid,
        userId: owner.id + 1, // another owner
      } as Folder;
      const roleId = v4();
      const encryptionKey = 'encryptionKey';
      const privateSharingFolderCustom = {
        ...privateSharingFolder,
        encryptionKey,
        folder: foundFolder,
      };
      privateSharingRepositoryMock.findById.mockResolvedValue(
        privateSharingFolderCustom,
      );

      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);
      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);

      await expect(
        privateSharingUseCase.createPrivateSharingFolder(
          owner,
          folderUuid,
          invatedUserEmail,
          encryptionKey,
        ),
      ).rejects.toThrow(InvalidOwnerError);

      await expect(
        privateSharingUseCase.grantPrivileges(
          owner,
          folderUuid,
          privateSharingFolder.id,
          roleId,
        ),
      ).rejects.toThrow(InvalidOwnerError);
    });

    it('When the invited user has a role in folder, then it should not be invited user again', async () => {
      const owner = user;
      const sharedWith = { ...user, id: user.id + 1 } as User;
      const invatedUserEmail = 'email@email.com';
      const folderUuid = v4();
      const foundFolder = {
        ...folders[0],
        uuid: folderUuid,
        userId: owner.id,
      } as Folder;
      const encryptionKey = 'encryptionKey';
      jest
        .spyOn(
          privateSharingRespository,
          'findPrivateFolderRoleByFolderIdAndUserId',
        )
        .mockResolvedValue(privateSharingFolderRole);

      jest
        .spyOn(folderUseCases, 'getFolderByUuid')
        .mockResolvedValue(foundFolder);
      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);
      await expect(
        privateSharingUseCase.createPrivateSharingFolder(
          owner,
          folderUuid,
          invatedUserEmail,
          encryptionKey,
        ),
      ).rejects.toThrow(UserAlreadyHasRole);
    });

    it('When the user is the owner of the folder, then it should not be invited user', async () => {
      // owner is the same that sharedWith
      const owner = user;
      const sharedWith = user;
      const invatedUserEmail = 'email@email.com';
      const folderUuid = v4();
      const encryptionKey = 'encryptionKey';
      jest
        .spyOn(userUseCases, 'getUserByUsername')
        .mockResolvedValue(sharedWith);

      expect(
        privateSharingUseCase.createPrivateSharingFolder(
          owner,
          folderUuid,
          invatedUserEmail,
          encryptionKey,
        ),
      ).rejects.toThrow(OwnerCannotBeSharedError);
    });
  });
});
