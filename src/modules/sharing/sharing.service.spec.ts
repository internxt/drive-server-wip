import { type ConfigService } from '@nestjs/config';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
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
  newRole,
  newSharing,
  newSharingInvite,
  newSharingRole,
  newUser,
  newPreCreatedUser,
  publicUser,
} from '../../../test/fixtures';
import * as jwtUtils from '../../lib/jwt';
import { PasswordNeededError, SharingService } from './sharing.service';
import { type SequelizeSharingRepository } from './sharing.repository';
import { type FolderUseCases } from '../folder/folder.usecase';
import { type FileUseCases } from '../file/file.usecase';
import { type UserUseCases } from '../user/user.usecase';
import { type SequelizeUserReferralsRepository } from '../user/user-referrals.repository';
import { type SequelizeFileRepository } from '../file/file.repository';
import {
  type Role,
  SharedWithType,
  SharingActionName,
  type SharingAttributes,
  SharingItemType,
  SharingType,
} from './sharing.domain';
import { FileStatus, type FileAttributes } from '../file/file.domain';
import { SharingNotFoundException } from './exception/sharing-not-found.exception';
import { type GetInviteDto } from './dto/get-invites.dto';

jest.mock('../../lib/jwt');
jest.mock('../../externals/mailer/mailer.service', () => ({
  MailerService: jest.fn().mockImplementation(() => ({
    sendInvitationToSharingGuestEmail: jest.fn().mockResolvedValue(undefined),
    sendInvitationToSharingReceivedEmail: jest
      .fn()
      .mockResolvedValue(undefined),
  })),
}));

describe('Sharing Use Cases', () => {
  let sharingService: SharingService;
  let sharingRepository: DeepMocked<SequelizeSharingRepository>;
  let fileRepository: DeepMocked<SequelizeFileRepository>;
  let folderUseCases: DeepMocked<FolderUseCases>;
  let fileUsecases: DeepMocked<FileUseCases>;
  let usersUsecases: DeepMocked<UserUseCases>;
  let userReferralsRepository: DeepMocked<SequelizeUserReferralsRepository>;
  let config: DeepMocked<ConfigService>;

  beforeEach(async () => {
    sharingRepository = createMock<SequelizeSharingRepository>();
    fileRepository = createMock<SequelizeFileRepository>();
    folderUseCases = createMock<FolderUseCases>();
    fileUsecases = createMock<FileUseCases>();
    usersUsecases = createMock<UserUseCases>();
    userReferralsRepository = createMock<SequelizeUserReferralsRepository>();
    config = createMock<ConfigService>();

    // Mock specific config values that are needed for MailerService
    config.get.mockImplementation((key: string) => {
      const configValues = {
        'mailer.apiKey': 'SG.test-api-key-mock',
        'mailer.sandbox': false,
        'mailer.from': 'test@example.com',
        'mailer.name': 'Test Mailer',
        'mailer.templates.invitationToSharingGuestReceived': 'template-id',
        'secrets.jwt': 'test-jwt-secret',
        'clients.drive.web': 'https://drive.internxt.com',
      };
      return configValues[key] || 'default-value';
    });

    sharingService = new SharingService(
      sharingRepository,
      fileRepository,
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
      ).rejects.toThrow(ForbiddenException);
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
      ).rejects.toThrow(ConflictException);
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
      jest.spyOn(sharingRepository, 'createSharingRole').mockResolvedValue();

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
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);
      jest.spyOn(sharingRepository, 'deleteInvitesBy').mockResolvedValue();
      jest.spyOn(sharingRepository, 'deleteSharingsBy').mockResolvedValue();

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
      jest.spyOn(sharingRepository, 'findOneSharing').mockResolvedValue(null);
      jest.spyOn(sharingRepository, 'deleteInvitesBy').mockResolvedValue();
      jest.spyOn(sharingRepository, 'deleteSharingsBy').mockResolvedValue();

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

      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);

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
      const file = newFile({ owner: newUser() });
      file.user = newUser();

      const sharedFilesInfo = [
        {
          itemId: file.uuid,
          encryptionKey: 'encrypted-key-123',
          createdAt: new Date(),
        },
      ];

      const filesWithUserData = [file];

      jest
        .spyOn(sharingRepository, 'getTeamsRelatedSharedFilesInfo')
        .mockResolvedValue(sharedFilesInfo);

      jest
        .spyOn(fileRepository, 'getFilesWithWorkspaceUser')
        .mockResolvedValue(filesWithUserData);

      jest.spyOn(usersUsecases, 'getAvatarUrl').mockResolvedValue('avatar-url');

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
        .spyOn(sharingRepository, 'getTeamsRelatedSharedFilesInfo')
        .mockResolvedValue([]);

      jest
        .spyOn(fileRepository, 'getFilesWithWorkspaceUser')
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

  describe('findSharingBy', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const sharing = newSharing({ owner, item: folder });

    it('When finding sharing by partial attributes, then it returns the sharing', async () => {
      const where = { id: sharing.id };
      sharingRepository.findOneSharingBy.mockResolvedValue(sharing);

      const result = await sharingService.findSharingBy(where);

      expect(result).toEqual(sharing);
      expect(sharingRepository.findOneSharingBy).toHaveBeenCalledWith(where);
    });

    it('When finding sharing by partial attributes and not found, then it returns null', async () => {
      const where = { id: 'non-existent' };
      sharingRepository.findOneSharingBy.mockResolvedValue(null);

      const result = await sharingService.findSharingBy(where);

      expect(result).toBeNull();
      expect(sharingRepository.findOneSharingBy).toHaveBeenCalledWith(where);
    });
  });

  describe('findSharingsBySharedWithAndAttributes', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const sharing = newSharing({ owner, item: folder });

    it('When finding sharings by shared with and attributes, then it returns the sharings', async () => {
      const sharedWithValues = [owner.uuid];
      const filters = { itemType: 'folder' as const };
      const options = { offset: 0, limit: 10 };
      const sharings = [sharing];

      sharingRepository.findSharingsBySharedWithAndAttributes.mockResolvedValue(
        sharings,
      );

      const result = await sharingService.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        options,
      );

      expect(result).toEqual(sharings);
      expect(
        sharingRepository.findSharingsBySharedWithAndAttributes,
      ).toHaveBeenCalledWith(sharedWithValues, filters, options);
    });

    it('When finding sharings without options, then it uses default options', async () => {
      const sharedWithValues = [owner.uuid];
      const filters = {};
      const sharings = [sharing];

      sharingRepository.findSharingsBySharedWithAndAttributes.mockResolvedValue(
        sharings,
      );

      const result = await sharingService.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
      );

      expect(result).toEqual(sharings);
      expect(
        sharingRepository.findSharingsBySharedWithAndAttributes,
      ).toHaveBeenCalledWith(sharedWithValues, filters, undefined);
    });
  });

  describe('findSharingRoleBy', () => {
    const sharingRole = newSharingRole();

    it('When finding sharing role by partial attributes, then it returns the sharing role', async () => {
      const where = { id: sharingRole.id };
      sharingRepository.findSharingRoleBy.mockResolvedValue(sharingRole);

      const result = await sharingService.findSharingRoleBy(where);

      expect(result).toEqual(sharingRole);
      expect(sharingRepository.findSharingRoleBy).toHaveBeenCalledWith(where);
    });

    it('When finding sharing role by partial attributes and not found, then it returns null', async () => {
      const where = { id: 'non-existent' };
      sharingRepository.findSharingRoleBy.mockResolvedValue(null);

      const result = await sharingService.findSharingRoleBy(where);

      expect(result).toBeNull();
      expect(sharingRepository.findSharingRoleBy).toHaveBeenCalledWith(where);
    });
  });

  describe('isItemBeingSharedAboveTheLimit', () => {
    const itemId = v4();
    const itemType = 'file';
    const type = SharingType.Private;

    it('When item is shared below the limit, then it returns false', async () => {
      sharingRepository.getSharingsCountBy.mockResolvedValue(50);
      sharingRepository.getInvitesCountBy.mockResolvedValue(30);

      const result = await sharingService.isItemBeingSharedAboveTheLimit(
        itemId,
        itemType,
        type,
      );

      expect(result).toBe(false);
    });

    it('When item is shared above the limit, then it returns true', async () => {
      sharingRepository.getSharingsCountBy.mockResolvedValue(70);
      sharingRepository.getInvitesCountBy.mockResolvedValue(50);

      const result = await sharingService.isItemBeingSharedAboveTheLimit(
        itemId,
        itemType,
        type,
      );

      expect(result).toBe(true);
    });

    it('When item is shared exactly at the limit, then it returns true', async () => {
      sharingRepository.getSharingsCountBy.mockResolvedValue(60);
      sharingRepository.getInvitesCountBy.mockResolvedValue(40);

      const result = await sharingService.isItemBeingSharedAboveTheLimit(
        itemId,
        itemType,
        type,
      );

      expect(result).toBe(true);
    });

    it('When checking with specific shared with type, then it passes the type to repository', async () => {
      const sharedWithType = SharedWithType.WorkspaceTeam;
      sharingRepository.getSharingsCountBy.mockResolvedValue(10);
      sharingRepository.getInvitesCountBy.mockResolvedValue(20);

      await sharingService.isItemBeingSharedAboveTheLimit(
        itemId,
        itemType,
        type,
        sharedWithType,
      );

      expect(sharingRepository.getSharingsCountBy).toHaveBeenCalledWith({
        itemId,
        itemType,
        type,
        sharedWithType,
      });
    });
  });

  describe('getInvites', () => {
    const owner = newUser();
    const folder = newFolder({ owner });

    it('When user is owner and gets invites for folder, then it calls repository', async () => {
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.getInvites.mockResolvedValue(expect.any(Object));

      await sharingService.getInvites(owner, 'folder', folder.uuid);

      expect(folderUseCases.getByUuid).toHaveBeenCalledWith(folder.uuid);
      expect(sharingRepository.getInvites).toHaveBeenCalledWith(
        { itemId: folder.uuid, itemType: 'folder' },
        100,
        0,
      );
    });

    it('When user is owner and gets invites for file, then it calls repository', async () => {
      const file = newFile({ owner });
      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.getInvites.mockResolvedValue(expect.any(Object));

      await sharingService.getInvites(owner, 'file', file.uuid);

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.getInvites).toHaveBeenCalledWith(
        { itemId: file.uuid, itemType: 'file' },
        100,
        0,
      );
    });

    it('When item is not found, then it throws NotFoundException', async () => {
      folderUseCases.getByUuid.mockResolvedValue(null);

      await expect(
        sharingService.getInvites(owner, 'folder', folder.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not the owner, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.getInvites(otherUser, 'folder', folder.uuid),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInvitesByUser', () => {
    const user = newUser();
    const limit = 10;
    const offset = 0;
    const folder = newFolder();
    const file = newFile();

    it('When user has folder and file invites, then it returns invites with items', async () => {
      const invites: GetInviteDto[] = [
        {
          ...newSharingInvite({
            itemId: folder.uuid,
            itemType: 'folder' as const,
            sharedWith: user.uuid,
            roleId: v4(),
          }),
          invited: { ...user, avatar: null },
        },
        {
          ...newSharingInvite({
            itemId: file.uuid,
            itemType: 'file' as const,
            sharedWith: user.uuid,
            roleId: v4(),
          }),
          invited: { ...user, avatar: null },
        },
      ];

      sharingRepository.getUserValidInvites.mockResolvedValue(invites);
      folderUseCases.getByUuids.mockResolvedValue([folder]);
      fileUsecases.getByUuids.mockResolvedValue([file]);

      const result = await sharingService.getInvitesByUser(user, limit, offset);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...invites[0],
        invited: { ...invites[0].invited, avatar: null },
        item: folder,
      });
      expect(result[1]).toEqual({
        ...invites[1],
        invited: { ...invites[1].invited, avatar: null },
        item: file,
      });
    });

    it('When user has only folder invites, then it returns only folder invites', async () => {
      const invites: GetInviteDto[] = [
        {
          ...newSharingInvite({
            itemId: folder.uuid,
            itemType: 'folder' as const,
            sharedWith: user.uuid,
            roleId: v4(),
          }),
          invited: { ...user, avatar: null },
        },
      ];

      sharingRepository.getUserValidInvites.mockResolvedValue(invites);
      folderUseCases.getByUuids.mockResolvedValue([folder]);
      fileUsecases.getByUuids.mockResolvedValue([]);

      const result = await sharingService.getInvitesByUser(user, limit, offset);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...invites[0],
        invited: { ...invites[0].invited, avatar: null },
        item: folder,
      });
    });

    it('When user has no invites, then it returns empty array', async () => {
      sharingRepository.getUserValidInvites.mockResolvedValue([]);
      folderUseCases.getByUuids.mockResolvedValue([]);
      fileUsecases.getByUuids.mockResolvedValue([]);

      const result = await sharingService.getInvitesByUser(user, limit, offset);

      expect(result).toEqual([]);
    });
  });

  describe('getRoles', () => {
    const roles = [newRole('READER'), newRole('EDITOR')];

    it('When getting roles, then it returns all roles', async () => {
      jest.spyOn(sharingRepository, 'findRoles').mockResolvedValue(roles);

      const result = await sharingService.getRoles();

      expect(result).toEqual(roles);
      expect(sharingRepository.findRoles).toHaveBeenCalled();
    });
  });

  describe('getUserRole', () => {
    const user = newUser();
    const owner = newUser();
    const folder = newFolder({ owner });
    const sharing = newSharing({ owner, item: folder });
    const role = newRole('READER');

    it('When user is owner, then it returns OWNER role', async () => {
      const ownerSharing = newSharing({ owner: user, item: folder });
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(ownerSharing);

      const result = await sharingService.getUserRole(ownerSharing.id, user);

      expect(result.name).toBe('OWNER');
      expect(result.sharingId).toBe(ownerSharing.id);
    });

    it('When user is shared with and has role, then it returns the role', async () => {
      const sharingRole = newSharingRole({
        sharingId: sharing.id,
        roleId: role.id,
      });

      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);
      jest
        .spyOn(sharingRepository, 'findSharingRoleBy')
        .mockResolvedValue(sharingRole);
      jest.spyOn(sharingRepository, 'findRoleBy').mockResolvedValue(role);

      const result = await sharingService.getUserRole(sharing.id, user);

      expect(result).toEqual({ ...role, sharingId: sharing.id });
    });

    it('When sharing is not found, then it throws NotFoundException', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.getUserRole(sharing.id, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('When sharing role is not found, then it throws NotFoundException', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      sharingRepository.findSharingRoleBy.mockResolvedValue(null);

      await expect(
        sharingService.getUserRole(sharing.id, user),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSharingRole', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const sharing = newSharing({ owner, item: folder });
    const updateDto = { roleId: v4() };

    it('When user is owner and updates role, then it updates the role', async () => {
      sharingRepository.findSharingById.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.updateSharingRoleBy.mockResolvedValue();

      await sharingService.updateSharingRole(owner, sharing.id, updateDto);

      expect(sharingRepository.updateSharingRoleBy).toHaveBeenCalledWith(
        { sharingId: sharing.id },
        updateDto,
      );
    });

    it('When sharing is not found, then it throws NotFoundException', async () => {
      sharingRepository.findSharingById.mockResolvedValue(null);

      await expect(
        sharingService.updateSharingRole(owner, sharing.id, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is not found, then it throws NotFoundException', async () => {
      sharingRepository.findSharingById.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(null);

      await expect(
        sharingService.updateSharingRole(owner, sharing.id, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not owner, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      sharingRepository.findSharingById.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.updateSharingRole(otherUser, sharing.id, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When sharing is for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      const fileSharing = newSharing({ owner, item: file });

      sharingRepository.findSharingById.mockResolvedValue(fileSharing);
      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.updateSharingRoleBy.mockResolvedValue();

      await sharingService.updateSharingRole(owner, fileSharing.id, updateDto);

      expect(sharingRepository.updateSharingRoleBy).toHaveBeenCalledWith(
        { sharingId: fileSharing.id },
        updateDto,
      );
    });
  });

  describe('removeSharingRole', () => {
    const owner = newUser();
    const sharedWithUser = newUser();
    const folder = newFolder({ owner });
    const sharing = newSharing({
      owner,
      item: folder,
      sharedWith: sharedWithUser,
    });
    const sharingRole = newSharingRole({ sharingId: sharing.id });

    it('When owner removes sharing role, then it removes the role', async () => {
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteSharingRole.mockResolvedValue();

      await sharingService.removeSharingRole(owner, sharingRole.id);

      expect(sharingRepository.deleteSharingRole).toHaveBeenCalledWith(
        sharingRole,
      );
    });

    it('When shared user removes own role, then it removes the role', async () => {
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteSharingRole.mockResolvedValue();

      await sharingService.removeSharingRole(sharedWithUser, sharingRole.id);

      expect(sharingRepository.deleteSharingRole).toHaveBeenCalledWith(
        sharingRole,
      );
    });

    it('When sharing role is not found, then it throws NotFoundException', async () => {
      sharingRepository.findSharingRole.mockResolvedValue(null);

      await expect(
        sharingService.removeSharingRole(owner, sharingRole.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When sharing is not found, then it throws NotFoundException', async () => {
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.removeSharingRole(owner, sharingRole.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When item is not found, then it throws NotFoundException', async () => {
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(null);

      await expect(
        sharingService.removeSharingRole(owner, sharingRole.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When owner tries to remove their own role, then it throws ConflictException', async () => {
      const ownerSharing = newSharing({
        owner,
        item: folder,
        sharedWith: owner,
      });
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(ownerSharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.removeSharingRole(owner, sharingRole.id),
      ).rejects.toThrow(ConflictException);
    });

    it('When user without permissions tries to remove role, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);
      sharingRepository.findOneSharing.mockResolvedValue(sharing);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.removeSharingRole(otherUser, sharingRole.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createInvite', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const inviteeUser = newUser();
    const createInviteDto = {
      itemId: folder.uuid,
      itemType: 'folder' as const,
      sharedWith: inviteeUser.email,
      roleId: v4(),
      encryptionKey: 'encryptionKey',
      encryptionAlgorithm: 'aes-256-gcm',
      type: 'OWNER' as const,
      persistPreviousSharing: false,
      notifyUser: false,
      notificationMessage: 'Test message',
    };

    it('When owner creates invite with existing user, then it creates the invite', async () => {
      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.getSharingsCountBy.mockResolvedValue(10);
      sharingRepository.getInvitesCountBy.mockResolvedValue(20);
      sharingRepository.createInvite.mockResolvedValue(expect.any(Object));

      await sharingService.createInvite(owner, createInviteDto);

      expect(sharingRepository.createInvite).toHaveBeenCalled();
    });

    it('When owner creates invite with pre-created user, then it creates the invite with expiration', async () => {
      const preCreatedUser = newPreCreatedUser();
      usersUsecases.findByEmail.mockResolvedValue(null);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(preCreatedUser);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.getSharingsCountBy.mockResolvedValue(10);
      sharingRepository.getInvitesCountBy.mockResolvedValue(20);
      sharingRepository.createInvite.mockResolvedValue(expect.any(Object));

      await sharingService.createInvite(owner, createInviteDto);

      expect(sharingRepository.createInvite).toHaveBeenCalled();
    });

    it('When owner tries to share with themselves, then it throws OwnerCannotBeSharedWithError', async () => {
      const selfInviteDto = { ...createInviteDto, sharedWith: owner.email };

      await expect(
        sharingService.createInvite(owner, selfInviteDto),
      ).rejects.toThrow('Owner cannot share the folder with itself');
    });

    it('When invited user not found, then it throws NotFoundException', async () => {
      usersUsecases.findByEmail.mockResolvedValue(null);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);

      await expect(
        sharingService.createInvite(owner, createInviteDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user already has invite, then it throws UserAlreadyHasRole', async () => {
      const existingInvite = newSharingInvite({
        itemId: folder.uuid,
        itemType: 'folder' as const,
        sharedWith: inviteeUser.uuid,
        roleId: v4(),
      });

      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(
        existingInvite,
      );

      await expect(
        sharingService.createInvite(owner, createInviteDto),
      ).rejects.toThrow('User already has a role');
    });

    it('When item is being shared above the limit, then it throws BadRequestException', async () => {
      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.getSharingsCountBy.mockResolvedValue(70);
      sharingRepository.getInvitesCountBy.mockResolvedValue(50);

      await expect(
        sharingService.createInvite(owner, createInviteDto),
      ).rejects.toThrow('Limit for sharing an item reach');
    });

    it('When user is not the owner, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.createInvite(otherUser, createInviteDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When creating invite for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      const fileInviteDto = {
        ...createInviteDto,
        itemId: file.uuid,
        itemType: 'file' as const,
      };

      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.getSharingsCountBy.mockResolvedValue(10);
      sharingRepository.getInvitesCountBy.mockResolvedValue(20);
      sharingRepository.createInvite.mockResolvedValue(expect.any(Object));

      await sharingService.createInvite(owner, fileInviteDto);

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.createInvite).toHaveBeenCalled();
    });

    it('When creating SELF type invite without encryption, then it works', async () => {
      const selfInviteDto = {
        ...createInviteDto,
        type: 'SELF' as const,
        encryptionKey: undefined,
        encryptionAlgorithm: undefined,
      };

      usersUsecases.findByEmail.mockResolvedValue(inviteeUser);
      usersUsecases.findPreCreatedByEmail.mockResolvedValue(null);
      sharingRepository.getInviteByItemAndUser.mockResolvedValue(null);
      sharingRepository.findOneSharing.mockResolvedValue(null);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.getSharingsCountBy.mockResolvedValue(10);
      sharingRepository.getInvitesCountBy.mockResolvedValue(20);
      sharingRepository.createInvite.mockResolvedValue(expect.any(Object));

      await sharingService.createInvite(owner, selfInviteDto);

      expect(sharingRepository.createInvite).toHaveBeenCalled();
    });

    it('When creating OWNER type invite without encryption, then it throws BadRequestException', async () => {
      const ownerInviteDto = {
        ...createInviteDto,
        encryptionKey: undefined,
        encryptionAlgorithm: undefined,
      };

      await expect(
        sharingService.createInvite(owner, ownerInviteDto),
      ).rejects.toThrow('Encryption algorithm and encryption key are required');
    });
  });

  describe('acceptInvite', () => {
    const owner = newUser();
    const inviteeUser = newUser();
    const folder = newFolder({ owner });
    const invite = newSharingInvite({
      itemId: folder.uuid,
      itemType: 'folder' as const,
      sharedWith: inviteeUser.uuid,
      roleId: v4(),
    });
    const acceptInviteDto = {
      encryptionKey: 'encryptionKey',
      encryptionAlgorithm: 'aes-256-gcm',
    };

    it('When user accepts invite, then it creates sharing and deletes invite', async () => {
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      usersUsecases.findById.mockResolvedValue(owner);
      sharingRepository.createSharing.mockResolvedValue(expect.any(Object));
      sharingRepository.createSharingRole.mockResolvedValue();
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.acceptInvite(
        inviteeUser,
        invite.id,
        acceptInviteDto,
      );

      expect(sharingRepository.createSharing).toHaveBeenCalled();
      expect(sharingRepository.createSharingRole).toHaveBeenCalled();
      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invite);
    });

    it('When user accepts request invite, then it uses provided encryption', async () => {
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      usersUsecases.findById.mockResolvedValue(owner);
      sharingRepository.createSharing.mockResolvedValue(expect.any(Object));
      sharingRepository.createSharingRole.mockResolvedValue();
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.acceptInvite(
        inviteeUser,
        invite.id,
        acceptInviteDto,
      );

      expect(sharingRepository.createSharing).toHaveBeenCalled();
      expect(sharingRepository.createSharingRole).toHaveBeenCalled();
      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invite);
    });

    it('When invite not found, then it throws NotFoundException', async () => {
      sharingRepository.getInviteById.mockResolvedValue(null);

      await expect(
        sharingService.acceptInvite(inviteeUser, invite.id, acceptInviteDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not the invited user, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      invite.isSharedWith = jest.fn().mockReturnValue(false);
      sharingRepository.getInviteById.mockResolvedValue(invite);

      await expect(
        sharingService.acceptInvite(otherUser, invite.id, acceptInviteDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When accepting request without encryption, then it throws BadRequestException', async () => {
      jest.spyOn(invite, 'isARequest').mockReturnValue(true);
      jest.spyOn(invite, 'isSharedWith').mockReturnValue(true);

      const incompleteDto = {
        encryptionKey: undefined,
        encryptionAlgorithm: undefined,
      };

      sharingRepository.getInviteById.mockResolvedValue(invite);

      await expect(
        sharingService.acceptInvite(inviteeUser, invite.id, incompleteDto),
      ).rejects.toThrow(
        'This invitation is a request, the encryption key is required',
      );
    });

    it('When owner not found, then it throws NotFoundException', async () => {
      jest.spyOn(invite, 'isSharedWith').mockReturnValue(true);
      jest.spyOn(invite, 'isARequest').mockReturnValue(false);

      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      usersUsecases.findById.mockResolvedValue(null);

      await expect(
        sharingService.acceptInvite(inviteeUser, invite.id, acceptInviteDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When accepting invite for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      const fileInvite = newSharingInvite({
        itemId: file.uuid,
        itemType: 'file' as const,
        sharedWith: inviteeUser.uuid,
        roleId: v4(),
      });

      jest.spyOn(fileInvite, 'isSharedWith').mockReturnValue(true);
      jest.spyOn(fileInvite, 'isARequest').mockReturnValue(false);

      sharingRepository.getInviteById.mockResolvedValue(fileInvite as any);
      fileUsecases.getByUuid.mockResolvedValue(file);
      usersUsecases.findById.mockResolvedValue(owner);
      sharingRepository.createSharing.mockResolvedValue(expect.any(Object));
      sharingRepository.createSharingRole.mockResolvedValue();
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.acceptInvite(
        inviteeUser,
        fileInvite.id,
        acceptInviteDto,
      );

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.createSharing).toHaveBeenCalled();
      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(fileInvite);
    });
  });

  describe('removeInvite', () => {
    const owner = newUser();
    const inviteeUser = newUser();
    const folder = newFolder({ owner });
    const invite = newSharingInvite({
      itemId: folder.uuid,
      itemType: 'folder' as const,
      sharedWith: inviteeUser.uuid,
      roleId: v4(),
    });

    it('When owner removes invite, then it deletes the invite', async () => {
      invite.isSharedWith = jest.fn().mockReturnValue(false);
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.removeInvite(owner, invite.id);

      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invite);
    });

    it('When invited user removes invite, then it deletes the invite', async () => {
      invite.isSharedWith = jest.fn().mockReturnValue(true);
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.removeInvite(inviteeUser, invite.id);

      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(invite);
    });

    it('When invite not found, then it throws UserNotFoundError', async () => {
      sharingRepository.getInviteById.mockResolvedValue(null);

      await expect(
        sharingService.removeInvite(owner, invite.id),
      ).rejects.toThrow();
    });

    it('When item not found, then it throws NotFoundException', async () => {
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(null);

      await expect(
        sharingService.removeInvite(owner, invite.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user is not owner and not invited, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      invite.isSharedWith = jest.fn().mockReturnValue(false);
      sharingRepository.getInviteById.mockResolvedValue(invite);
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.removeInvite(otherUser, invite.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When removing invite for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      const fileInvite = newSharingInvite({
        itemId: file.uuid,
        itemType: 'file' as const,
        sharedWith: owner.uuid,
        roleId: v4(),
      });

      jest.spyOn(fileInvite, 'isSharedWith').mockReturnValue(false);
      sharingRepository.getInviteById.mockResolvedValue(fileInvite as any);
      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.deleteInvite.mockResolvedValue();

      await sharingService.removeInvite(owner, fileInvite.id);

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(fileInvite);
    });
  });

  describe('createPublicSharing', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const createSharingDto = {
      itemId: folder.uuid,
      itemType: 'folder' as const,
      encryptionKey: 'encryptionKey',
      encryptionAlgorithm: 'aes-256-gcm',
      encryptedCode: 'encryptedCode',
      encryptedPassword: null,
      persistPreviousSharing: false,
    };

    it('When owner creates public sharing, then it creates the sharing', async () => {
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharingBy.mockResolvedValue(null);
      sharingRepository.createSharing.mockResolvedValue(expect.any(Object));
      userReferralsRepository.applyUserReferral.mockResolvedValue();

      const result = await sharingService.createPublicSharing(
        owner,
        createSharingDto,
      );

      expect(sharingRepository.createSharing).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('When public sharing already exists, then it returns existing sharing', async () => {
      const existingSharing = newSharing({
        owner,
        item: folder,
        sharingType: SharingType.Public,
      });

      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharingBy.mockResolvedValue(existingSharing);

      const result = await sharingService.createPublicSharing(
        owner,
        createSharingDto,
      );

      expect(result).toEqual(existingSharing);
      expect(sharingRepository.createSharing).not.toHaveBeenCalled();
    });

    it('When creating public sharing without encrypted code, then it throws BadRequestException', async () => {
      const invalidDto = { ...createSharingDto, encryptedCode: undefined };

      await expect(
        sharingService.createPublicSharing(owner, invalidDto),
      ).rejects.toThrow(
        'The "encryptedCode" is required when the sharing "type" is public',
      );
    });

    it('When user is not owner, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.findOneSharingBy.mockResolvedValue(null);

      await expect(
        sharingService.createPublicSharing(otherUser, createSharingDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When creating public sharing for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      const fileDto = {
        ...createSharingDto,
        itemId: file.uuid,
        itemType: 'file' as const,
      };

      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.findOneSharingBy.mockResolvedValue(null);
      sharingRepository.createSharing.mockResolvedValue(expect.any(Object));
      userReferralsRepository.applyUserReferral.mockResolvedValue();

      await sharingService.createPublicSharing(owner, fileDto);

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.createSharing).toHaveBeenCalled();
    });

    it('When creating with invalid item type, then it throws BadRequestException', async () => {
      const invalidDto = { ...createSharingDto, itemType: 'invalid' as any };

      await expect(
        sharingService.createPublicSharing(owner, invalidDto),
      ).rejects.toThrow('Wrong item type');
    });
  });

  describe('validateInvite', () => {
    const inviteId = v4();
    const expiredInvite = newSharingInvite({
      expirationAt: new Date(Date.now() - 1000 * 60 * 60),
    });
    const validInvite = newSharingInvite({
      expirationAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    it('When invite is valid, then it returns the invite uuid', async () => {
      sharingRepository.getInviteById.mockResolvedValue(validInvite);

      const result = await sharingService.validateInvite(inviteId);

      expect(result).toEqual({ uuid: inviteId });
    });

    it('When invite is expired, then it deletes the invite and throws NotFoundException', async () => {
      sharingRepository.getInviteById.mockResolvedValue(expiredInvite);
      sharingRepository.deleteInvite.mockResolvedValue();

      await expect(sharingService.validateInvite(inviteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(sharingRepository.deleteInvite).toHaveBeenCalledWith(
        expiredInvite,
      );
    });

    it('When invite not found, then it throws BadRequestException', async () => {
      sharingRepository.getInviteById.mockResolvedValue(null);

      await expect(sharingService.validateInvite(inviteId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When invite has no expiration, then it throws BadRequestException', async () => {
      const inviteWithoutExpiration = newSharingInvite();
      inviteWithoutExpiration.expirationAt = null;

      sharingRepository.getInviteById.mockResolvedValue(
        inviteWithoutExpiration,
      );

      await expect(sharingService.validateInvite(inviteId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When invite id is not valid uuid, then it throws BadRequestException', async () => {
      await expect(
        sharingService.validateInvite('invalid-uuid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeSharingType', () => {
    const owner = newUser();
    const folder = newFolder({ owner });
    const itemId = folder.uuid;
    const itemType = 'folder' as const;

    it('When user is owner and changes to private, then it deletes public sharings', async () => {
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteSharingsBy.mockResolvedValue();

      await sharingService.changeSharingType(
        owner,
        itemId,
        itemType,
        SharingType.Private,
      );

      expect(sharingRepository.deleteSharingsBy).toHaveBeenCalledWith({
        itemId,
        itemType,
        type: SharingType.Public,
        ownerId: owner.uuid,
        sharedWithType: SharedWithType.Individual,
      });
    });

    it('When user is owner and changes to public, then it does not delete sharings', async () => {
      folderUseCases.getByUuid.mockResolvedValue(folder);
      sharingRepository.deleteSharingsBy.mockResolvedValue();

      await sharingService.changeSharingType(
        owner,
        itemId,
        itemType,
        SharingType.Public,
      );

      expect(sharingRepository.deleteSharingsBy).not.toHaveBeenCalled();
    });

    it('When user is not owner, then it throws ForbiddenException', async () => {
      const otherUser = newUser();
      folderUseCases.getByUuid.mockResolvedValue(folder);

      await expect(
        sharingService.changeSharingType(
          otherUser,
          itemId,
          itemType,
          SharingType.Private,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When changing type for file, then it handles file correctly', async () => {
      const file = newFile({ owner });
      fileUsecases.getByUuid.mockResolvedValue(file);
      sharingRepository.deleteSharingsBy.mockResolvedValue();

      await sharingService.changeSharingType(
        owner,
        file.uuid,
        'file',
        SharingType.Private,
      );

      expect(fileUsecases.getByUuid).toHaveBeenCalledWith(file.uuid);
      expect(sharingRepository.deleteSharingsBy).toHaveBeenCalled();
    });
  });

  describe('getSharingType', () => {
    const user = newUser();
    const itemId = v4();
    const itemType = 'folder' as const;

    it('When public sharing exists, then it returns the public sharing', async () => {
      const publicSharing = newSharing({ sharingType: SharingType.Public });
      sharingRepository.findOneByOwnerOrSharedWithItem.mockImplementation(
        (sharedWith, id, type, sharingType) => {
          if (sharingType === SharingType.Public) {
            return Promise.resolve(publicSharing);
          }
          return Promise.resolve(null);
        },
      );

      const result = await sharingService.getSharingType(
        user,
        itemId,
        itemType,
      );

      expect(result).toEqual(publicSharing);
    });

    it('When private sharing exists, then it returns the private sharing', async () => {
      const privateSharing = newSharing({ sharingType: SharingType.Private });
      sharingRepository.findOneByOwnerOrSharedWithItem.mockImplementation(
        (sharedWith, id, type, sharingType) => {
          if (sharingType === SharingType.Private) {
            return Promise.resolve(privateSharing);
          }
          return Promise.resolve(null);
        },
      );

      const result = await sharingService.getSharingType(
        user,
        itemId,
        itemType,
      );

      expect(result).toEqual(privateSharing);
    });

    it('When no sharing exists, then it throws NotFoundException', async () => {
      sharingRepository.findOneByOwnerOrSharedWithItem.mockResolvedValue(null);

      await expect(
        sharingService.getSharingType(user, itemId, itemType),
      ).rejects.toThrow(NotFoundException);
    });

    it('When checking with team shared with type, then it passes the type to repository', async () => {
      const publicSharing = newSharing({ sharingType: SharingType.Public });
      sharingRepository.findOneByOwnerOrSharedWithItem.mockResolvedValue(
        publicSharing,
      );

      await sharingService.getSharingType(
        user,
        itemId,
        itemType,
        SharedWithType.WorkspaceTeam,
      );

      expect(
        sharingRepository.findOneByOwnerOrSharedWithItem,
      ).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
        itemId,
        itemType,
        SharingType.Public,
        SharedWithType.WorkspaceTeam,
      );
    });
  });

  describe('findSharingsWithRolesByItem', () => {
    const folder = newFolder();
    const sharingsWithRoles: (SharingAttributes & { role: Role })[] = [
      {
        ...newSharing({
          sharedWith: newUser(),
          owner: newUser(),
        }),
        role: newRole('READER'),
      },
    ];

    it('When finding sharings with roles by item, then it returns the sharings with roles', async () => {
      sharingRepository.findSharingsWithRolesByItem.mockResolvedValue(
        sharingsWithRoles,
      );

      const result = await sharingService.findSharingsWithRolesByItem(folder);

      expect(result).toEqual(sharingsWithRoles);
      expect(
        sharingRepository.findSharingsWithRolesByItem,
      ).toHaveBeenCalledWith(folder);
    });

    it('When no sharings found, then it returns empty array', async () => {
      sharingRepository.findSharingsWithRolesByItem.mockResolvedValue([]);

      const result = await sharingService.findSharingsWithRolesByItem(folder);

      expect(result).toEqual([]);
    });
  });

  describe('getSharedFiles', () => {
    const user = newUser();
    const offset = 0;
    const limit = 10;
    const order: [keyof FileAttributes, 'ASC' | 'DESC'][] = [['name', 'ASC']];
    const fileOwner = newUser();
    const file = newFile({ owner: fileOwner });
    file.user = fileOwner;
    const sharedFileInfo = [
      {
        itemId: file.uuid,
        encryptionKey: 'encrypted-key-123',
        createdAt: new Date(),
      },
    ];

    const filesWithUserData = [file];

    it('When user has shared files, then it returns files with shared info', async () => {
      sharingRepository.getUserRelatedSharedFilesInfo.mockResolvedValue(
        sharedFileInfo,
      );
      fileUsecases.getFilesAndUserByUuid.mockResolvedValue(filesWithUserData);
      fileUsecases.decrypFileName.mockReturnValue({
        plainName: file.plainName,
      });
      usersUsecases.getAvatarUrl.mockResolvedValue(
        'https://example.com/avatar.jpg',
      );

      const result = await sharingService.getSharedFiles(
        user,
        offset,
        limit,
        order,
      );

      expect(fileUsecases.getFilesAndUserByUuid).toHaveBeenCalledWith(
        [file.uuid],
        order,
      );

      expect(result).toEqual({
        folders: [],
        files: [
          {
            ...file,
            credentials: {
              networkPass: fileOwner.userId,
              networkUser: fileOwner.bridgeUser,
            },
            sharedWithMe: true,
            dateShared: sharedFileInfo[0].createdAt,
            encryptionKey: sharedFileInfo[0].encryptionKey,
          },
        ],
        credentials: {
          networkPass: user.userId,
          networkUser: user.bridgeUser,
        },
        token: '',
        role: 'OWNER',
      });
    });

    it('When file already has plainName, then it does not decrypt', async () => {
      const fileWithPlainName = Object.assign(file, {
        plainName: 'Already Plain Name.txt',
        user: fileOwner,
      });

      sharingRepository.getUserRelatedSharedFilesInfo.mockResolvedValue(
        sharedFileInfo,
      );
      fileUsecases.getFilesAndUserByUuid.mockResolvedValue([fileWithPlainName]);
      usersUsecases.getAvatarUrl.mockResolvedValue(null);

      const result = await sharingService.getSharedFiles(
        user,
        offset,
        limit,
        order,
      );

      expect(fileUsecases.decrypFileName).not.toHaveBeenCalled();
      expect(result.files[0].plainName).toBe('Already Plain Name.txt');
    });
    it('When file owner has no avatar, then it returns null for avatar', async () => {
      const fileOwnerWithoutAvatar = {
        ...fileOwner,
        avatar: null,
      };
      const fileWithoutAvatar = Object.assign(file, {
        user: fileOwnerWithoutAvatar,
      });

      sharingRepository.getUserRelatedSharedFilesInfo.mockResolvedValue(
        sharedFileInfo,
      );
      fileUsecases.getFilesAndUserByUuid.mockResolvedValue([fileWithoutAvatar]);
      fileUsecases.decrypFileName.mockReturnValue({
        plainName: 'Decrypted File.txt',
      });

      const result = await sharingService.getSharedFiles(
        user,
        offset,
        limit,
        order,
      );

      expect(usersUsecases.getAvatarUrl).not.toHaveBeenCalled();
      expect(result.files[0].user.avatar).toBe(null);
    });

    it('When user owns the file, then sharedWithMe is false', async () => {
      const ownedFile = Object.assign(file, {
        user: user, // same user as the requester
      });

      sharingRepository.getUserRelatedSharedFilesInfo.mockResolvedValue(
        sharedFileInfo,
      );
      fileUsecases.getFilesAndUserByUuid.mockResolvedValue([ownedFile]);
      fileUsecases.decrypFileName.mockReturnValue({ plainName: 'My File.txt' });
      usersUsecases.getAvatarUrl.mockResolvedValue(
        'https://example.com/avatar.jpg',
      );

      const result = await sharingService.getSharedFiles(
        user,
        offset,
        limit,
        order,
      );

      expect(result.files[0].sharedWithMe).toBe(false);
    });
  });
});
