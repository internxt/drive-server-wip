import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { v4 } from 'uuid';

import {
  newFolder,
  newSharing,
  newSharingRole,
  newUser,
} from '../../../test/fixtures';
import configuration from '../../config/configuration';
import { InvalidPermissionsError, SharingService } from './sharing.service';
import { SequelizeSharingRepository } from './sharing.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { FileUseCases } from '../file/file.usecase';
import { UserUseCases } from '../user/user.usecase';
import { SequelizeUserRepository } from '../user/user.repository';

describe('Sharing Use Cases', () => {
  let sharingService: SharingService;
  let sharingRepository: SequelizeSharingRepository;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userUseCases: UserUseCases;

  const userRepositoryMock = {
    findByUuid: jest.fn(),
  };

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
        SharingService,
        {
          provide: SequelizeSharingRepository,
          useValue: createMock<SequelizeSharingRepository>(),
        },
        {
          provide: SequelizeUserRepository,
          useValue: userRepositoryMock,
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

    sharingService = module.get<SharingService>(SharingService);
    sharingRepository = module.get<SequelizeSharingRepository>(
      SequelizeSharingRepository,
    );
    folderUseCases = module.get<FolderUseCases>(FolderUseCases);
    fileUseCases = module.get<FileUseCases>(FileUseCases);
    userUseCases = module.get<UserUseCases>(UserUseCases);
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

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);
      jest
        .spyOn(sharingRepository, 'findSharingRoleBy')
        .mockResolvedValue(sharingRole);

      const removeFolderRoleMock = jest.spyOn(
        sharingRepository,
        'deleteSharingRole',
      );
      const removeSharedWithMock = jest.spyOn(
        sharingRepository,
        'deleteSharing',
      );

      await sharingService.removeSharedWith(
        folder.uuid,
        'folder',
        otherUser.uuid,
        otherUser,
      );

      expect(removeFolderRoleMock).toHaveBeenCalled();
      expect(removeSharedWithMock).toHaveBeenCalled();
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

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);

      await expect(
        sharingService.removeSharedWith(
          folder.uuid,
          'folder',
          otherUser.uuid,
          notTheOwner,
        ),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('When the owner tries to remove its own sharing, then it should not be allowed to remove itself', async () => {
      const owner = newUser();
      const folder = newFolder({ owner });
      const sharing = null;

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);

      await expect(
        sharingService.removeSharedWith(
          folder.uuid,
          'folder',
          owner.uuid,
          owner,
        ),
      ).rejects.toThrowError(ConflictException);
    });

    it('When the owner tries to remove a user that is not invited to the folder then, it fails', async () => {
      const owner = newUser();
      const otherUser = newUser();
      const folder = newFolder({ owner });

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest.spyOn(sharingRepository, 'findOneSharing').mockResolvedValue(null);

      await expect(
        sharingService.removeSharedWith(
          folder.uuid,
          'folder',
          otherUser.uuid,
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

      jest.spyOn(folderUseCases, 'getByUuid').mockResolvedValue(folder);
      jest
        .spyOn(sharingRepository, 'findOneSharing')
        .mockResolvedValue(sharing);
      jest
        .spyOn(sharingRepository, 'findSharingRoleBy')
        .mockResolvedValue(sharingRole);

      const removeFolderRoleMock = jest.spyOn(
        sharingRepository,
        'deleteSharingRole',
      );
      const removeSharedWithMock = jest.spyOn(
        sharingRepository,
        'deleteSharing',
      );

      const response = await sharingService.removeSharedWith(
        folder.uuid,
        'folder',
        otherUser.uuid,
        owner,
      );

      expect(removeFolderRoleMock).toHaveBeenCalled();
      expect(removeSharedWithMock).toHaveBeenCalled();
    });
  });
});
