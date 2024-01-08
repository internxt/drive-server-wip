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
  newSharing,
  newSharingRole,
  newUser,
  publicUser,
} from '../../../test/fixtures';
import { PasswordNeededError, SharingService } from './sharing.service';
import { SequelizeSharingRepository } from './sharing.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { SequelizeUserReferralsRepository } from '../user/user-referrals.repository';
import { SharingType } from './sharing.domain';
import { FileStatus } from '../file/file.domain';

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
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);

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
      sharingRepository.findSharingRole.mockResolvedValue(sharingRole);

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
});
