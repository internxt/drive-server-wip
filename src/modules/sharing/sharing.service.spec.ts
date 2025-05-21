import { ConfigService } from '@nestjs/config';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';

import {
  newFile,
  newFolder,
  newPermission,
  newSharing,
  newSharingRole,
  newUser,
  publicUser,
} from '../../../test/fixtures';
import * as jwtUtils from '../../lib/jwt';
import { PasswordNeededError, SharingService } from './sharing.service';
import { SequelizeSharingRepository } from './sharing.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../storage/file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { SequelizeUserReferralsRepository } from '../user/user-referrals.repository';
import {
  SharedWithType,
  SharingActionName,
  SharingItemType,
  SharingType,
} from './sharing.domain';
import { FileStatus } from '../storage/file/file.domain';
import { SharingNotFoundException } from './exception/sharing-not-found.exception';

jest.mock('../../lib/jwt');

describe('Sharing Use Cases', () => {
  let sharingService: SharingService;
  let sharingRepository: DeepMocked<SequelizeSharingRepository>;
  let folderUseCases: DeepMocked<FolderUseCases>;
  let fileUsecases: DeepMocked<FileUseCases>;
  let usersUsecases: DeepMocked<UserUseCases>;
  let userReferralsRepository: DeepMocked<SequelizeUserReferralsRepository>;
  let config: DeepMocked<ConfigService>;

  beforeEach(async () => {
    sharingRepository = createMock<SequelizeSharingRepository>();
    folderUseCases = createMock<FolderUseCases>();
    fileUsecases = createMock<FileUseCases>();
    usersUsecases = createMock<UserUseCases>();
    userReferralsRepository = createMock<SequelizeUserReferralsRepository>();
    config = createMock<ConfigService>();

    sharingService = new SharingService(
      sharingRepository,
      fileUsecases,
      folderUseCases,
      usersUsecases,
      config,
      userReferralsRepository,
    );
  });

  it('should be defined', () => {
    expect(sharingService).toBeDefined();
    expect(sharingRepository).toBeDefined();
  });

  describe('Owner removes a user from a shared folder', () => {
    it('When the user is not the owner and tries to remove himself from a sharing folder, it works', async () => {
      const owner = newUser();
      const otherUser = newUser();
      const folder = newFolder({ owner });
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
      });
      const sharingRole = newSharingRole({
        sharingId: sharing.id,
        roleId: v4(),
      });

      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      sharingRepository.findSharingRoleBy.mockResolvedValue(sharingRole);

      await sharingService.removeSharedWith(
        folder.uuid,
        'folder',
        otherUser.uuid,
        otherUser,
      );

      expect(sharingRepository.deleteSharing).toHaveBeenCalledWith(sharing.id);
      expect(sharingRepository.deleteSharingRole).toHaveBeenCalledWith(
        sharingRole,
      );
    });

    it('When the user is not the owner and is requesting the removal of other user then, it fails', async () => {
      const owner = newUser();
      const notTheOwner = newUser();
      const otherUser = newUser();
      const folder = newFolder({ owner });
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
      });

      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.removeSharedWith(
          folder.uuid,
          'folder',
          owner.uuid,
          notTheOwner,
        ),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('When the owner tries to remove a user that is not invited to the folder then, it fails', async () => {
      const owner = newUser();
      const folder = newFolder({ owner });

      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.removeSharedWith(
          folder.uuid,
          folder.type as any,
          'not invited user uudi',
          owner,
        ),
      ).rejects.toThrowError(ConflictException);
    });

    it('When the owner removes a user which was previously invited then, it should work', async () => {
      const owner = newUser();
      const otherUser = newUser();
      const folder = newFolder({ owner });
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
      });
      const sharingRole = newSharingRole({
        sharingId: sharing.id,
        roleId: v4(),
      });

      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      sharingRepository.findSharingRoleBy.mockResolvedValue(sharingRole);

      await sharingService.removeSharedWith(
        folder.uuid,
        'folder',
        otherUser.uuid,
        owner,
      );

      expect(sharingRepository.deleteSharing).toHaveBeenCalledWith(sharing.id);
      expect(sharingRepository.deleteSharingRole).toHaveBeenCalledWith(
        sharingRole,
      );
    });
  });

  describe('Add protection to a public sharing', () => {
    const owner = newUser();
    const otherUser = publicUser();
    const folder = newFolder({ owner });
    const encryptedPassword =
      'jeH++sl4x/RmjambJlUs0Y5ugKWdb8ZcwDGS4bhM7emeibsxWXaKtoA673iVY6wbk/pk+WRXQH/qlAi91j+ReQ3Cn9odACF9DoRU81g2dXDJV679MRjbttUMFRo/vWS2PUaKjmm8JQ==';

    it('When owner adds password to a public sharing, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      sharingRepository.updateSharing.mockResolvedValue();

      const sharingUpdated = await sharingService.setSharingPassword(
        owner,
        sharing.id,
        encryptedPassword,
      );

      expect(sharingRepository.updateSharing).toHaveBeenCalledWith(
        { id: sharing.id },
        sharing,
      );
      expect(sharingUpdated.encryptedPassword).toBe(encryptedPassword);
    });

    it('When not owner tries to add a password to a public sharing, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.setSharingPassword(otherUser, sharing.id, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('When owner tries to set a password for a private sharing, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Private,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.setSharingPassword(otherUser, sharing.id, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('When owner tries to add a password to a non existing sharing, then it fails', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.setSharingPassword(owner, '', ''),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Remove public sharing protection', () => {
    const owner = newUser();
    const otherUser = publicUser();
    const folder = newFolder({ owner });

    it('When owner tries to remove a password from a public sharing, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      sharingRepository.updateSharing.mockResolvedValue();

      const sharingUpdated = await sharingService.removeSharingPassword(
        owner,
        sharing.id,
      );
      expect(sharingRepository.updateSharing).toHaveBeenCalledWith(
        { id: sharing.id },
        sharing,
      );
      expect(sharingUpdated.encryptedPassword).toBe(null);
    });

    it('When not owner user tries to remove the password, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.setSharingPassword(otherUser, sharing.id, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('When owner user tries to remove password from a private sharing, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Private,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.setSharingPassword(otherUser, sharing.id, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user tries to remove a password to a non existing sharing, then it fails', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.removeSharingPassword(owner, ''),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Access to public sharing meta', () => {
    const owner = newUser();
    const otherUser = publicUser();
    const folder = newFolder({ owner });
    const correctPassword = 'example';
    const code =
      '8ab1d0725b61e0f1f95a466aeeecc0be53e3a18c0feb09d659b666017505c796';
    const encryptedPassword =
      'jeH++sl4x/RmjambJlUs0Y5ugKWdb8ZcwDGS4bhM7emeibsxWXaKtoA673iVY6wbk/pk+WRXQH/qlAi91j+ReQ3Cn9odACF9DoRU81g2dXDJV679MRjbttUMFRo/vWS2PUaKjmm8JQ==';

    it('When user gets access to password protected sharing with correct password, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
        encryptedPassword,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      usersUsecases.getUser.mockResolvedValue(owner);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      const publicSharing = await sharingService.getPublicSharingById(
        sharing.id,
        code,
        correctPassword,
      );

      expect(publicSharing).toStrictEqual({ ...sharing, item: folder });
    });

    it('When user tries to access to password protected with incorrect password, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
        encryptedPassword,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      usersUsecases.getUser.mockResolvedValue(owner);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.getPublicSharingById(
          sharing.id,
          code,
          'notCorrectPlainPassword',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user tries to access to a password protected sharing without any password, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
        encryptedPassword,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      usersUsecases.getUser.mockResolvedValue(owner);

      await expect(
        sharingService.getPublicSharingById(sharing.id, null, null),
      ).rejects.toThrow(PasswordNeededError);
    });

    it('When user tries to access to a non existing sharing, then it fails', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(sharingService.getPublicSharingItemInfo('')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Bulk remove sharings', () => {
    it('When function is called, then invitations and sharings are removed ', async () => {
      const owner = newUser();
      const itemIds = ['uuid1', 'uuid2'];
      const itemType = 'file';

      await sharingService.bulkRemoveSharings(owner, itemIds, itemType);

      expect(sharingRepository.bulkDeleteInvites).toHaveBeenCalledWith(
        itemIds,
        itemType,
      );
      expect(sharingRepository.bulkDeleteSharings).toHaveBeenCalledWith(
        owner.uuid,
        itemIds,
        itemType,
        SharedWithType.Individual,
      );
    });
  });

  describe('canPerfomAction', () => {
    const sharedWith = v4();
    const resourceId = v4();
    const action = SharingActionName.UploadFile;
    const sharedWithType = SharedWithType.Individual;

    it('When the permission exists, then it should return true', async () => {
      const permissions = [
        newPermission(),
        newPermission({ name: SharingActionName.UploadFile }),
      ];
      jest
        .spyOn(sharingRepository, 'findPermissionsInSharing')
        .mockResolvedValue(permissions);

      const result = await sharingService.canPerfomAction(
        sharedWith,
        resourceId,
        action,
        sharedWithType,
      );

      expect(result).toBe(true);
    });

    it('When the permission does not match, then it should return false', async () => {
      const permissions = [
        newPermission({ name: SharingActionName.UploadFile }),
      ];
      jest
        .spyOn(sharingRepository, 'findPermissionsInSharing')
        .mockResolvedValue(permissions);

      const result = await sharingService.canPerfomAction(
        sharedWith,
        resourceId,
        SharingActionName.RenameItems,
        sharedWithType,
      );

      expect(result).toBe(false);
    });

    it('When there are no permissions, then it should return false', async () => {
      const permissions = [];
      jest
        .spyOn(sharingRepository, 'findPermissionsInSharing')
        .mockResolvedValue(permissions);

      const result = await sharingService.canPerfomAction(
        sharedWith,
        resourceId,
        action,
        sharedWithType,
      );

      expect(result).toBe(false);
    });
  });

  describe('createSharing', () => {
    const sharing = newSharing();
    const roleId = v4();

    it('When creating a sharing, then it should return the created sharing', async () => {
      const createdSharing = newSharing();

      jest
        .spyOn(sharingRepository, 'createSharing')
        .mockResolvedValue(createdSharing);

      const result = await sharingService.createSharing(sharing, roleId);

      expect(result).toEqual(createdSharing);
      expect(sharingRepository.createSharing).toHaveBeenCalledWith(sharing);
      expect(sharingRepository.createSharingRole).toHaveBeenCalledWith({
        roleId,
        sharingId: createdSharing.id,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('removeSharing', () => {
    const owner = newUser();
    const itemFile = newFile();
    const itemId = itemFile.uuid;
    const itemType = SharingItemType.File;
    const sharing = newSharing({ owner, item: itemFile });

    it('When sharing exists and user is owner, then it removes invites and sharings', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await sharingService.removeSharing(owner, itemId, itemType);

      expect(sharingRepository.findOneSharing).toHaveBeenCalledWith({
        itemId,
        itemType,
      });
      expect(sharingRepository.deleteInvitesBy).toHaveBeenCalledWith({
        itemId,
        itemType,
      });
      expect(sharingRepository.deleteSharingsBy).toHaveBeenCalledWith({
        itemId,
        itemType,
      });
    });

    it('When sharing does not exist, then it does nothing', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await sharingService.removeSharing(owner, itemId, itemType);

      expect(sharingRepository.findOneSharing).toHaveBeenCalledWith({
        itemId,
        itemType,
      });
      expect(sharingRepository.deleteInvitesBy).not.toHaveBeenCalled();
      expect(sharingRepository.deleteSharingsBy).not.toHaveBeenCalled();
    });

    it('When user is not owner, then it throws', async () => {
      const otherUser = newUser();

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.removeSharing(otherUser, itemId, itemType),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSharedFilesInWorkspaceByTeams', () => {
    const user = newUser();
    const teamIds = [v4(), v4()];
    const workspaceId = v4();
    const offset = 0;
    const limit = 10;
    const order: [string, string][] = [['name', 'asc']];

    it('When files are shared with teams user belongs to, then it should return the files', async () => {
      const sharing = newSharing();
      sharing.file = newFile({ owner: newUser() });
      sharing.file.user = newUser();

      const filesWithSharedInfo = [sharing];

      jest
        .spyOn(sharingRepository, 'findFilesSharedInWorkspaceByOwnerAndTeams')
        .mockResolvedValue(filesWithSharedInfo);

      jest
        .spyOn(fileUsecases, 'decrypFileName')
        .mockReturnValue({ plainName: 'DecryptedFileName' });

      jest.spyOn(usersUsecases, 'getAvatarUrl').mockResolvedValue('avatar-url');

      jest
        .spyOn(jwtUtils, 'generateWithDefaultSecret')
        .mockReturnValue('generatedToken');

      const result = await sharingService.getSharedFilesInWorkspaceByTeams(
        user,
        workspaceId,
        teamIds,
        { offset, limit, order },
      );

      expect(result).toEqual(
        expect.objectContaining({
          credentials: expect.objectContaining({
            networkUser: expect.any(String),
            networkPass: expect.any(String),
          }),
          folders: expect.arrayContaining([]),
          files: expect.arrayContaining([
            expect.objectContaining({
              plainName: expect.any(String),
              encryptionKey: expect.any(String),
              user: expect.objectContaining({
                email: expect.any(String),
                name: expect.any(String),
              }),
            }),
          ]),
          token: '',
          role: expect.any(String),
        }),
      );
    });

    it('When no files are shared with teams user belongs to, then it should return nothing', async () => {
      jest
        .spyOn(sharingRepository, 'findFilesSharedInWorkspaceByOwnerAndTeams')
        .mockResolvedValue([]);

      const result = await sharingService.getSharedFilesInWorkspaceByTeams(
        user,
        workspaceId,
        teamIds,
        { offset, limit, order },
      );

      expect(result).toEqual({
        folders: [],
        files: [],
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
        role: 'OWNER',
      });
    });

    it('When there is an error fetching shared files, then it should throw', async () => {
      const error = new Error('Database error');

      jest
        .spyOn(sharingRepository, 'findFilesSharedInWorkspaceByOwnerAndTeams')
        .mockRejectedValue(error);

      await expect(
        sharingService.getSharedFilesInWorkspaceByTeams(
          user,
          workspaceId,
          teamIds,
          {
            offset,
            limit,
            order,
          },
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('getSharedFoldersInWorkspaceByTeams', () => {
    const user = newUser();
    const teamIds = [v4(), v4()];
    const workspaceId = v4();
    const offset = 0;
    const limit = 10;
    const order: [string, string][] = [['name', 'asc']];

    it('When folders are shared with a team the user belongs to, then it should return the folders', async () => {
      const sharing = newSharing();
      const folder = newFolder();
      folder.user = newUser();
      sharing.folder = folder;
      sharing.folder.user = newUser();
      const foldersWithSharedInfo = [sharing];

      jest
        .spyOn(sharingRepository, 'findFoldersSharedInWorkspaceByOwnerAndTeams')
        .mockResolvedValue(foldersWithSharedInfo);

      jest
        .spyOn(folderUseCases, 'decryptFolderName')
        .mockReturnValue(newFolder());

      jest.spyOn(usersUsecases, 'getAvatarUrl').mockResolvedValue('avatar-url');
      jest
        .spyOn(jwtUtils, 'generateWithDefaultSecret')
        .mockReturnValue('generatedToken');

      const result = await sharingService.getSharedFoldersInWorkspaceByTeams(
        user,
        workspaceId,
        teamIds,
        { offset, limit, order },
      );

      expect(result).toEqual(
        expect.objectContaining({
          credentials: expect.objectContaining({
            networkPass: expect.any(String),
            networkUser: expect.any(String),
          }),
          files: expect.arrayContaining([]),
          folders: expect.arrayContaining([
            expect.objectContaining({
              plainName: expect.any(String),
              encryptionKey: expect.any(String),
            }),
          ]),
          token: '',
          role: expect.any(String),
        }),
      );
    });

    it('When no folders are shared with a team the user belongs to, then it should return an empty folders array', async () => {
      jest
        .spyOn(sharingRepository, 'findFoldersSharedInWorkspaceByOwnerAndTeams')
        .mockResolvedValue([]);

      const result = await sharingService.getSharedFoldersInWorkspaceByTeams(
        user,
        workspaceId,
        teamIds,
        { offset, limit, order },
      );

      expect(result).toEqual({
        folders: [],
        files: [],
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
        role: 'OWNER',
      });
    });

    it('When there is an error fetching shared folders, then it should throw an error', async () => {
      const error = new Error('Database error');

      jest
        .spyOn(sharingRepository, 'findFoldersSharedInWorkspaceByOwnerAndTeams')
        .mockRejectedValue(error);

      await expect(
        sharingService.getSharedFoldersInWorkspaceByTeams(
          user,
          workspaceId,
          teamIds,
          {
            offset,
            limit,
            order,
          },
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('Access to public shared item info', () => {
    const owner = newUser();
    const otherUser = publicUser();
    const folder = newFolder({ owner });
    const file = newFile({ owner });

    it('When user tries to access to public shared folder info, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      const publicSharing = await sharingService.getPublicSharingItemInfo(
        sharing.id,
      );

      expect(publicSharing).toStrictEqual({
        plainName: folder.plainName,
        size: folder.size,
        type: folder.type,
      });
    });

    it('When user tries access to public shared file info, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: file,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      fileUsecases.getByUuid.mockResolvedValue(file);

      const publicSharing = await sharingService.getPublicSharingItemInfo(
        sharing.id,
      );

      expect(publicSharing).toStrictEqual({
        plainName: file.plainName,
        size: file.size,
        type: file.type,
      });
    });

    it('When user tries to access to a public shared file that was deleted, then it fails', async () => {
      const deletedFile = newFile({
        owner,
        attributes: { status: FileStatus.DELETED },
      });
      const sharing = newSharing({
        owner,
        item: deletedFile,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      fileUsecases.getByUuid.mockResolvedValue(deletedFile);

      await expect(
        sharingService.getPublicSharingItemInfo(sharing.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user tries to access to a public shared folder that was deleted, then it fails', async () => {
      const deletedFolder = newFolder({
        owner,
        attributes: { removed: true },
      });
      const sharing = newSharing({
        owner,
        item: deletedFolder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(deletedFolder);

      await expect(
        sharingService.getPublicSharingItemInfo(sharing.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user tries to access to a sharing that is not public, then it fails', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Private,
      });

      sharingRepository.findOneSharing.mockResolvedValue(sharing);

      await expect(
        sharingService.getPublicSharingItemInfo(sharing.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When user tries to access to a non existing sharing, then it fails', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(sharingService.getPublicSharingItemInfo('')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('get sharing folder size', () => {
    const owner = newUser();
    const otherUser = publicUser();
    const folder = newFolder({ owner });

    it('When user tries to get sharing folder size with a public folder, then it works', async () => {
      const sharing = newSharing({
        owner,
        item: folder,
        sharedWith: otherUser,
        sharingType: SharingType.Public,
      });

      const expectedSize = 100;

      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getFolderSizeByUuid.mockResolvedValue(expectedSize);

      const publicSharingSize = await sharingService.getPublicSharingFolderSize(
        sharing.id,
      );

      expect(publicSharingSize).toStrictEqual(expectedSize);
    });

    it('When user tries to get sharing folder size and folder is not found, then it fails', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.getPublicSharingFolderSize(''),
      ).rejects.toThrow(SharingNotFoundException);
    });
  });

  describe('getItemSharingInfo', () => {
    const owner = newUser();
    const item = newFile();
    const itemType = 'file';

    it('When item has public sharing, then it returns the public sharing info', async () => {
      const publicSharing = newSharing({
        owner,
        item,
        sharingType: SharingType.Public,
        encryptedPassword: 'encryptedPassword',
      });
      publicSharing.encryptedCode = 'encryptedCode';

      sharingRepository.findOneByOwnerOrSharedWithItem.mockImplementation(
        (ownerUuid, iId, iType, sharingType) => {
          if (sharingType === SharingType.Public) {
            return Promise.resolve(publicSharing);
          }
          return Promise.resolve(null);
        },
      );

      sharingRepository.getInvitesNumberByItem.mockResolvedValue(2);

      const result = await sharingService.getItemSharingInfo(
        owner,
        item.uuid,
        itemType,
      );

      expect(result).toEqual({
        publicSharing: {
          id: publicSharing.id,
          isPasswordProtected: true,
          encryptedCode: 'encryptedCode',
        },
        type: SharingType.Public,
        invitationsCount: 2,
      });
    });

    it('When item has private sharing but no public sharing, then it returns no public sharing info', async () => {
      const privateSharing = newSharing({
        owner,
        item,
        sharingType: SharingType.Private,
      });

      sharingRepository.findOneByOwnerOrSharedWithItem.mockImplementation(
        (ownerUuid, iId, iType, sharingType) => {
          if (sharingType === SharingType.Public) {
            return Promise.resolve(null);
          }
          return Promise.resolve(privateSharing);
        },
      );

      sharingRepository.getInvitesNumberByItem.mockResolvedValue(3);

      const result = await sharingService.getItemSharingInfo(
        owner,
        item.uuid,
        itemType,
      );

      expect(result).toEqual({
        publicSharing: null,
        type: SharingType.Private,
        invitationsCount: 3,
      });
    });

    it('When item has no sharing but has invitations, then it returns private type', async () => {
      sharingRepository.findOneByOwnerOrSharedWithItem.mockResolvedValue(null);
      sharingRepository.getInvitesNumberByItem.mockResolvedValue(1);

      const result = await sharingService.getItemSharingInfo(
        owner,
        item.uuid,
        itemType,
      );

      expect(result).toEqual({
        publicSharing: null,
        type: SharingType.Private,
        invitationsCount: 1,
      });
    });

    it('When item has no sharing and no invitations, then it throws', async () => {
      sharingRepository.findOneByOwnerOrSharedWithItem.mockResolvedValue(null);
      sharingRepository.getInvitesNumberByItem.mockResolvedValue(0);

      await expect(
        sharingService.getItemSharingInfo(owner, item.uuid, itemType),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
