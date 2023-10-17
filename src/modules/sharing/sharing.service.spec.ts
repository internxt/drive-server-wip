import { ConfigService } from '@nestjs/config';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { v4 } from 'uuid';

import {
  newFolder,
  newSharing,
  newSharingRole,
  newUser,
} from '../../../test/fixtures';
import { SharingService } from './sharing.service';
import { SequelizeSharingRepository } from './sharing.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';

describe('Sharing Use Cases', () => {
  let sharingService: SharingService;
  let sharingRepository: DeepMocked<SequelizeSharingRepository>;
  let folderUseCases: DeepMocked<FolderUseCases>;
  let fileUsecases: DeepMocked<FileUseCases>;
  let usersUsecases: DeepMocked<UserUseCases>;
  let config: DeepMocked<ConfigService>;

  beforeEach(async () => {
    sharingRepository = createMock<SequelizeSharingRepository>();
    folderUseCases = createMock<FolderUseCases>();
    fileUsecases = createMock<FileUseCases>();
    usersUsecases = createMock<UserUseCases>();
    config = createMock<ConfigService>();

    sharingService = new SharingService(
      sharingRepository,
      fileUsecases,
      folderUseCases,
      usersUsecases,
      config,
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
});
