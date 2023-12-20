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

    it('Owner successfully adds password protection to their sharings, it works', async () => {
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

    it('Not owner user tries to set password', async () => {
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

    it('Owner tries to set password for a private sharing, not successful', async () => {
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

    it('User tries to add a password to a non existing sharing, not successful', async () => {
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

    it('Owner successfully removes password protection to their sharings', async () => {
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

    it('Not owner user tries to remove password', async () => {
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

    it('Owner tries to remove password for a private sharing, not successful', async () => {
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

    it('User tries to remove a password to a non existing sharing, not successful', async () => {
      sharingRepository.findOneSharing.mockResolvedValue(null);

      await expect(
        sharingService.setSharingPassword(owner, '', ''),
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

    it('Users get access to password protected sharing with correct password', async () => {
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

    it('Users get access to password protected with incorrect password', async () => {
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

    it('User tries to access to a password protected sharing without any password', async () => {
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
  });
});
