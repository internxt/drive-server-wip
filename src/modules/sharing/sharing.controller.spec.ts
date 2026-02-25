import { SharingController } from './sharing.controller';
import { type SharingService } from './sharing.service';
import { type UuidDto } from '../../common/dto/uuid.dto';
import { createMock } from '@golevelup/ts-jest';
import { type Sharing, SharingType } from './sharing.domain';
import {
  newSharing,
  newUser,
  newFile,
  newFolder,
  newSharingInvite,
  newRole,
} from '../../../test/fixtures';
import getEnv from '../../config/configuration';
import { BadRequestException } from '@nestjs/common';
import { type CreateInviteDto } from './dto/create-invite.dto';
import { type AcceptInviteDto } from './dto/accept-invite.dto';
import { type ChangeSharingType } from './dto/change-sharing-type.dto';
import { type UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import { type SetSharingPasswordDto } from './dto/set-sharing-password.dto';
import { type CreateSharingDto } from './dto/create-sharing.dto';
import { type User } from '../user/user.domain';
import { type File } from '../file/file.domain';
import { type Folder } from '../folder/folder.domain';

jest.mock('../../config/configuration');

describe('SharingController', () => {
  let controller: SharingController;
  let sharingService: SharingService;

  let sharing: Sharing;
  let user: User;
  let file: File;
  let folder: Folder;

  beforeEach(async () => {
    sharingService = createMock<SharingService>();

    controller = new SharingController(sharingService);
    sharing = newSharing({});
    user = newUser();
    file = newFile();
    folder = newFolder();
  });

  describe('getPublicSharing', () => {
    it('When getting public sharing with valid code and password, then it returns the sharing', async () => {
      const sharingId = sharing.id;
      const code = 'valid-code';
      const password = 'valid-password';
      const expectedSharing = {
        itemType: 'file' as const,
        itemId: file.uuid,
        encryptionAlgorithm: 'aes256',
        encryptionKey: 'key',
        createdAt: new Date(),
        updatedAt: new Date(),
        type: SharingType.Public,
        item: file,
        itemToken: 'token',
      };

      jest
        .spyOn(sharingService, 'getPublicSharingById')
        .mockResolvedValue(expectedSharing);

      const result = await controller.getPublicSharing(
        sharingId,
        code,
        password,
      );

      expect(result).toBe(expectedSharing);
      expect(sharingService.getPublicSharingById).toHaveBeenCalledWith(
        sharingId,
        code,
        password,
      );
    });

    it('When getting public sharing without code, then it throws BadRequestException', async () => {
      const sharingId = sharing.id;

      await expect(
        controller.getPublicSharing(sharingId, null, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('When getting public sharing with encoded password, then it decodes the password', async () => {
      const sharingId = sharing.id;
      const code = 'valid-code';
      const encodedPassword = 'encoded%20password';
      const expectedSharing = {
        itemType: 'file' as const,
        itemId: file.uuid,
        encryptionAlgorithm: 'aes256',
        encryptionKey: 'key',
        createdAt: new Date(),
        updatedAt: new Date(),
        type: SharingType.Public,
        item: file,
        itemToken: 'token',
      };

      jest
        .spyOn(sharingService, 'getPublicSharingById')
        .mockResolvedValue(expectedSharing);

      await controller.getPublicSharing(sharingId, code, encodedPassword);

      expect(sharingService.getPublicSharingById).toHaveBeenCalledWith(
        sharingId,
        code,
        'encoded password',
      );
    });
  });

  describe('getPublicSharingItemInfo', () => {
    it('When getting public sharing item info, then it returns the item info', async () => {
      const sharingId = sharing.id;
      const expectedItemInfo = {
        plainName: 'Test File',
        size: 1024,
        type: 'file',
      };

      jest
        .spyOn(sharingService, 'getPublicSharingItemInfo')
        .mockResolvedValue(expectedItemInfo);

      const result = await controller.getPublicSharingItemInfo(sharingId);

      expect(result).toBe(expectedItemInfo);
      expect(sharingService.getPublicSharingItemInfo).toHaveBeenCalledWith(
        sharingId,
      );
    });
  });

  describe('setPublicSharingPassword', () => {
    it('When setting public sharing password, then it calls service with correct parameters', async () => {
      const sharingId = sharing.id;
      const sharingPasswordDto: SetSharingPasswordDto = {
        encryptedPassword: 'encrypted-password',
      };
      const expectedSharing = newSharing();

      jest
        .spyOn(sharingService, 'setSharingPassword')
        .mockResolvedValue(expectedSharing);

      const result = await controller.setPublicSharingPassword(
        user,
        sharingId,
        sharingPasswordDto,
      );

      expect(result).toBe(expectedSharing);
      expect(sharingService.setSharingPassword).toHaveBeenCalledWith(
        user,
        sharingId,
        'encrypted-password',
      );
    });
  });

  describe('removePublicSharingPassword', () => {
    it('When removing public sharing password, then it calls service with correct parameters', async () => {
      const sharingId = sharing.id;
      const expectedSharing = newSharing();

      jest
        .spyOn(sharingService, 'removeSharingPassword')
        .mockResolvedValue(expectedSharing);

      const result = await controller.removePublicSharingPassword(
        user,
        sharingId,
      );

      expect(result).toBe(expectedSharing);
      expect(sharingService.removeSharingPassword).toHaveBeenCalledWith(
        user,
        sharingId,
      );
    });
  });

  describe('getInvites', () => {
    it('When getting invites for file, then it calls service with correct parameters', async () => {
      const itemType = 'file';
      const itemId = file.uuid;
      const expectedInvites = [
        {
          ...newSharingInvite(),
          invited: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            avatar: user.avatar,
          },
        },
      ];

      jest
        .spyOn(sharingService, 'getInvites')
        .mockResolvedValue(expectedInvites);

      const result = await controller.getInvites(user, itemType, itemId);

      expect(result).toBe(expectedInvites);
      expect(sharingService.getInvites).toHaveBeenCalledWith(
        user,
        itemType,
        itemId,
      );
    });

    it('When getting invites for folder, then it calls service with correct parameters', async () => {
      const itemType = 'folder';
      const itemId = folder.uuid;
      const expectedInvites = [
        {
          ...newSharingInvite(),
          invited: {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            avatar: user.avatar,
          },
        },
      ];

      jest
        .spyOn(sharingService, 'getInvites')
        .mockResolvedValue(expectedInvites);

      const result = await controller.getInvites(user, itemType, itemId);

      expect(result).toBe(expectedInvites);
      expect(sharingService.getInvites).toHaveBeenCalledWith(
        user,
        itemType,
        itemId,
      );
    });

    it('When getting invites with invalid item type, then it throws BadRequestException', async () => {
      const itemType = 'invalid';
      const itemId = 'some-id';

      await expect(async () => {
        await controller.getInvites(user, itemType, itemId);
      }).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeSharingType', () => {
    it('When changing sharing type for file, then it calls service with correct parameters', async () => {
      const itemType = 'file';
      const itemId = file.uuid;
      const dto: ChangeSharingType = { sharingType: SharingType.Public };

      jest
        .spyOn(sharingService, 'changeSharingType')
        .mockResolvedValue(undefined);

      const result = await controller.changeSharingType(
        user,
        itemType,
        itemId,
        dto,
      );

      expect(result).toBeUndefined();
      expect(sharingService.changeSharingType).toHaveBeenCalledWith(
        user,
        itemId,
        itemType,
        SharingType.Public,
      );
    });

    it('When changing sharing type with invalid item type, then it throws BadRequestException', async () => {
      const itemType = 'invalid' as any;
      const itemId = 'some-id';
      const dto: ChangeSharingType = { sharingType: SharingType.Public };

      await expect(async () => {
        await controller.changeSharingType(user, itemType, itemId, dto);
      }).rejects.toThrow(BadRequestException);
    });
  });

  describe('createInvite', () => {
    it('When creating invite, then it calls service with correct parameters', async () => {
      const createInviteDto: CreateInviteDto = {
        itemId: file.uuid,
        itemType: 'file',
        sharedWith: 'user@example.com',
        encryptionKey: 'encryption-key',
        encryptionAlgorithm: 'aes256',
        type: 'OWNER',
        roleId: 'role-id',
        notifyUser: true,
        persistPreviousSharing: false,
      };
      const expectedInvite = newSharingInvite();

      jest
        .spyOn(sharingService, 'createInvite')
        .mockResolvedValue(expectedInvite);

      const result = await controller.createInvite(user, createInviteDto);

      expect(result).toBe(expectedInvite);
      expect(sharingService.createInvite).toHaveBeenCalledWith(
        user,
        createInviteDto,
      );
    });
  });

  describe('acceptInvite', () => {
    it('When accepting invite, then it calls service with correct parameters', async () => {
      const inviteId = 'invite-id';
      const acceptInviteDto: AcceptInviteDto = {
        encryptionKey: 'encryption-key',
        encryptionAlgorithm: 'aes256',
      };

      jest.spyOn(sharingService, 'acceptInvite').mockResolvedValue(undefined);

      const result = await controller.acceptInvite(
        user,
        acceptInviteDto,
        inviteId,
      );

      expect(result).toBeUndefined();
      expect(sharingService.acceptInvite).toHaveBeenCalledWith(
        user,
        inviteId,
        acceptInviteDto,
      );
    });
  });

  describe('removeInvite', () => {
    it('When removing invite, then it calls service with correct parameters', async () => {
      const inviteId = 'invite-id';

      jest.spyOn(sharingService, 'removeInvite').mockResolvedValue(undefined);

      const result = await controller.removeInvite(user, inviteId);

      expect(result).toBeUndefined();
      expect(sharingService.removeInvite).toHaveBeenCalledWith(user, inviteId);
    });
  });

  describe('createSharing', () => {
    it('When creating sharing, then it calls service with correct parameters', async () => {
      const createSharingDto: CreateSharingDto = {
        itemId: file.uuid,
        itemType: 'file',
        encryptionKey: 'encryption-key',
        encryptionAlgorithm: 'aes256',
        encryptedCode: 'encrypted-code',
        encryptedPassword: 'encrypted-password',
        persistPreviousSharing: false,
      };
      const expectedSharing = newSharing();

      jest
        .spyOn(sharingService, 'createPublicSharing')
        .mockResolvedValue(expectedSharing);

      const result = await controller.createSharing(user, createSharingDto);

      expect(result).toBe(expectedSharing);
      expect(sharingService.createPublicSharing).toHaveBeenCalledWith(
        user,
        createSharingDto,
      );
    });
  });

  describe('removeSharing', () => {
    it('When removing sharing for file, then it calls service with correct parameters', async () => {
      const itemType = 'file';
      const itemId = file.uuid;

      jest.spyOn(sharingService, 'removeSharing').mockResolvedValue(undefined);

      await controller.removeSharing(user, itemType, itemId);

      expect(sharingService.removeSharing).toHaveBeenCalledWith(
        user,
        itemId,
        itemType,
      );
    });

    it('When removing sharing for folder, then it calls service with correct parameters', async () => {
      const itemType = 'folder';
      const itemId = folder.uuid;

      jest.spyOn(sharingService, 'removeSharing').mockResolvedValue(undefined);

      await controller.removeSharing(user, itemType, itemId);

      expect(sharingService.removeSharing).toHaveBeenCalledWith(
        user,
        itemId,
        itemType,
      );
    });
  });

  describe('getRoles', () => {
    it('When getting roles, then it calls service and returns roles', async () => {
      const expectedRoles = [newRole('OWNER'), newRole('EDITOR')];

      jest.spyOn(sharingService, 'getRoles').mockResolvedValue(expectedRoles);

      const result = await controller.getRoles();

      expect(result).toBe(expectedRoles);
      expect(sharingService.getRoles).toHaveBeenCalled();
    });
  });

  describe('getUserRole', () => {
    it('When getting user role, then it calls service with correct parameters', async () => {
      const sharingId = sharing.id;
      const expectedRole = { name: 'EDITOR' };

      jest.spyOn(sharingService, 'getUserRole').mockResolvedValue(expectedRole);

      const result = await controller.getUserRole(user, sharingId);

      expect(result).toBe(expectedRole);
      expect(sharingService.getUserRole).toHaveBeenCalledWith(sharingId, user);
    });
  });

  describe('updateSharingRole', () => {
    it('When updating sharing role, then it calls service with correct parameters', async () => {
      const sharingId = sharing.id;
      const dto: UpdateSharingRoleDto = { roleId: 'new-role-id' };

      jest
        .spyOn(sharingService, 'updateSharingRole')
        .mockResolvedValue(undefined);

      const result = await controller.updateSharingRole(user, sharingId, dto);

      expect(result).toBeUndefined();
      expect(sharingService.updateSharingRole).toHaveBeenCalledWith(
        user,
        sharingId,
        dto,
      );
    });
  });

  describe('removeSharingRole', () => {
    it('When removing sharing role, then it calls service with correct parameters', async () => {
      const sharingId = sharing.id;
      const sharingRoleId = 'role-id';

      jest
        .spyOn(sharingService, 'removeSharingRole')
        .mockResolvedValue(undefined);

      const result = await controller.removeSharingRole(
        user,
        sharingId,
        sharingRoleId,
      );

      expect(result).toBeUndefined();
      expect(sharingService.removeSharingRole).toHaveBeenCalledWith(
        user,
        sharingRoleId,
      );
    });
  });

  describe('get public sharing folder size', () => {
    it('When request the get sharing size method, then it works', async () => {
      const expectedResult = 100;

      jest
        .spyOn(sharingService, 'getPublicSharingFolderSize')
        .mockResolvedValue(expectedResult);

      const result = await controller.getPublicSharingFolderSize({
        id: sharing.id,
      } as UuidDto);

      expect(result).toStrictEqual({ size: expectedResult });
      expect(sharingService.getPublicSharingFolderSize).toHaveBeenCalledWith(
        sharing.id,
      );
    });
  });

  describe('get public sharing domains', () => {
    it('When requesting the get sharing domains method, then it should return the list of domains', async () => {
      const expectedResult = [
        'https://share.example.com',
        'https://share.example.org',
      ];

      jest.mocked(getEnv).mockReturnValue({
        apis: {
          share: { url: expectedResult.join(',') },
        },
      } as any);

      const result = await controller.getPublicSharingDomains();

      expect(result).toStrictEqual({ list: expectedResult });
    });
  });

  describe('getSharingType', () => {
    it('When getting sharing type for file, then it calls service', async () => {
      const expectedSharing = newSharing();
      jest.spyOn(sharingService, 'getSharingType').mockResolvedValue(expectedSharing);

      const result = await controller.getSharingType(user, 'file', file.uuid);

      expect(result).toBe(expectedSharing);
      expect(sharingService.getSharingType).toHaveBeenCalledWith(user, file.uuid, 'file');
    });

    it('When getting sharing type for folder, then it calls service', async () => {
      const expectedSharing = newSharing();
      jest.spyOn(sharingService, 'getSharingType').mockResolvedValue(expectedSharing);

      const result = await controller.getSharingType(user, 'folder', folder.uuid);

      expect(result).toBe(expectedSharing);
    });

    it('When item type is invalid, then it fails', () => {
      expect(() =>
        controller.getSharingType(user, 'invalid' as any, 'some-id'),
      ).toThrow(BadRequestException);
    });
  });

  describe('getItemSharingStatus', () => {
    it('When getting item sharing info for file, then it calls service', async () => {
      const expectedInfo = { type: 'public', invitationsCount: 1, publicSharing: null };
      jest.spyOn(sharingService, 'getItemSharingInfo').mockResolvedValue(expectedInfo as any);

      const result = await controller.getItemSharingStatus(user, 'file', file.uuid);

      expect(result).toBe(expectedInfo);
      expect(sharingService.getItemSharingInfo).toHaveBeenCalledWith(user, file.uuid, 'file');
    });

    it('When getting item sharing info for folder, then it calls service', async () => {
      const expectedInfo = { type: 'private', invitationsCount: 0, publicSharing: null };
      jest.spyOn(sharingService, 'getItemSharingInfo').mockResolvedValue(expectedInfo as any);

      const result = await controller.getItemSharingStatus(user, 'folder', folder.uuid);

      expect(result).toBe(expectedInfo);
    });

    it('When item type is invalid, then it fails', () => {
      expect(() =>
        controller.getItemSharingStatus(user, 'invalid' as any, 'some-id'),
      ).toThrow(BadRequestException);
    });
  });

  describe('getInvitesByUser', () => {
    it('When getting invites with valid params, then it returns invites', async () => {
      const expectedInvites = [{ id: 'invite-1' }];
      jest.spyOn(sharingService, 'getInvitesByUser').mockResolvedValue(expectedInvites as any);

      const result = await controller.getInvitesByUser(user, 10, 0);

      expect(result).toEqual({ invites: expectedInvites });
      expect(sharingService.getInvitesByUser).toHaveBeenCalledWith(user, 10, 0);
    });

    it('When limit is out of range (too low), then it throws', async () => {
      await expect(
        controller.getInvitesByUser(user, -1, 0),
      ).rejects.toThrow();
    });

    it('When offset is out of range (too low), then it throws', async () => {
      await expect(
        controller.getInvitesByUser(user, 10, -1),
      ).rejects.toThrow();
    });
  });

  describe('validateInvite', () => {
    it('When invite is valid, then it returns the uuid', async () => {
      const inviteId = 'invite-uuid';
      jest.spyOn(sharingService, 'validateInvite').mockResolvedValue({ uuid: inviteId });

      const result = await controller.validateInvite(inviteId);

      expect(result).toEqual({ uuid: inviteId });
    });

    it('When invite is invalid, then it fails', async () => {
      jest.spyOn(sharingService, 'validateInvite').mockRejectedValue(new BadRequestException());

      await expect(controller.validateInvite('id')).rejects.toThrow(BadRequestException);
    });

    it('When an unexpected error occurs while validating, then it fails', async () => {
      jest.spyOn(sharingService, 'validateInvite').mockRejectedValue(new Error('unexpected'));

      await expect(controller.validateInvite('id')).rejects.toThrow();
    });
  });

  describe('getFoldersInPrivateSharedFolder', () => {
    it('When getting folders in private shared folder, then it calls service', async () => {
      const expectedResult = { items: [], credentials: {}, token: '', bucket: '', encryptionKey: null, parent: { uuid: null, name: null }, name: 'test', role: 'OWNER' };
      jest.spyOn(sharingService, 'getFoldersInSharedFolder').mockResolvedValue(expectedResult as any);

      const result = await controller.getFoldersInPrivateSharedFolder(
        user,
        folder.uuid,
        { token: 'some-token', page: 0, perPage: 50 },
      );

      expect(result).toBe(expectedResult);
      expect(sharingService.getFoldersInSharedFolder).toHaveBeenCalledWith(
        folder.uuid, 'some-token', user, 0, 50,
      );
    });

    it('When no page/perPage provided, then it uses defaults', async () => {
      jest.spyOn(sharingService, 'getFoldersInSharedFolder').mockResolvedValue({} as any);

      await controller.getFoldersInPrivateSharedFolder(user, folder.uuid, {} as any);

      expect(sharingService.getFoldersInSharedFolder).toHaveBeenCalledWith(
        folder.uuid, undefined, user, 0, 50,
      );
    });
  });

  describe('getFilesInPrivateSharedFolder', () => {
    it('When getting files in private shared folder, then it calls service', async () => {
      const expectedResult = { items: [], credentials: {}, token: '', bucket: '', encryptionKey: null, parent: { uuid: null, name: null }, name: 'test', role: 'OWNER' };
      jest.spyOn(sharingService, 'getFilesInSharedFolder').mockResolvedValue(expectedResult as any);

      const result = await controller.getFilesInPrivateSharedFolder(
        user,
        folder.uuid,
        { token: 'some-token', page: 0, perPage: 50 },
      );

      expect(result).toBe(expectedResult);
      expect(sharingService.getFilesInSharedFolder).toHaveBeenCalledWith(
        folder.uuid, 'some-token', user, 0, 50,
      );
    });
  });

  describe('getPublicShareFiles', () => {
    it('When getting public share files, then it calls service', async () => {
      const expectedResult = { items: [], credentials: {}, token: '', bucket: '', encryptionKey: null, parent: { uuid: null, name: null }, name: 'test', role: 'NONE' };
      jest.spyOn(sharingService, 'getFilesFromPublicFolder').mockResolvedValue(expectedResult as any);

      const result = await controller.getPublicShareFiles(
        folder.uuid, 'token', 'code', 0, 50,
      );

      expect(result).toBe(expectedResult);
      expect(sharingService.getFilesFromPublicFolder).toHaveBeenCalledWith(
        folder.uuid, 'token', 'code', 0, 50,
      );
    });
  });

  describe('getPublicSharedFolders', () => {
    it('When getting public shared folders, then it calls service', async () => {
      const expectedResult = { items: [], credentials: {}, token: '', bucket: '', encryptionKey: null, parent: { uuid: null, name: null }, name: 'test', role: 'NONE' };
      jest.spyOn(sharingService, 'getFoldersFromPublicFolder').mockResolvedValue(expectedResult as any);

      const result = await controller.getPublicSharedFolders(
        folder.uuid, 'token', 'code', 0, 50,
      );

      expect(result).toBe(expectedResult);
      expect(sharingService.getFoldersFromPublicFolder).toHaveBeenCalledWith(
        folder.uuid, 'token', 0, 50,
      );
    });
  });

  describe('getSharedFoldersWithAUser', () => {
    it('When getting shared folders with user, then it returns folders', async () => {
      const expectedFolders = [folder];
      jest.spyOn(sharingService, 'getSharedFoldersBySharedWith').mockResolvedValue(expectedFolders);

      const result = await controller.getSharedFoldersWithAUser(user, undefined, 0, 50);

      expect(result).toEqual({ folders: expectedFolders });
    });

    it('When orderBy is provided, then it passes order to service', async () => {
      jest.spyOn(sharingService, 'getSharedFoldersBySharedWith').mockResolvedValue([]);

      await controller.getSharedFoldersWithAUser(user, 'createdAt:DESC' as any, 0, 50);

      expect(sharingService.getSharedFoldersBySharedWith).toHaveBeenCalledWith(
        user, 0, 50, [['createdAt', 'DESC']],
      );
    });

    it('When service fails, then it fails', async () => {
      jest.spyOn(sharingService, 'getSharedFoldersBySharedWith').mockRejectedValue(new Error('fail'));

      await expect(
        controller.getSharedFoldersWithAUser(user, undefined, 0, 50),
      ).rejects.toThrow('fail');
    });
  });

  describe('getSharedFolders (shared-by-me)', () => {
    it('When getting shared folders by owner, then it returns folders', async () => {
      const expectedFolders = [folder];
      jest.spyOn(sharingService, 'getSharedFoldersByOwner').mockResolvedValue(expectedFolders);

      const result = await controller.getSharedFolders(user, undefined, 0, 50);

      expect(result).toEqual({ folders: expectedFolders });
    });

    it('When orderBy is provided, then it passes order to service', async () => {
      jest.spyOn(sharingService, 'getSharedFoldersByOwner').mockResolvedValue([]);

      await controller.getSharedFolders(user, 'name:ASC' as any, 0, 50);

      expect(sharingService.getSharedFoldersByOwner).toHaveBeenCalledWith(
        user, 0, 50, [['name', 'ASC']],
      );
    });

    it('When service fails, then it fails', async () => {
      jest.spyOn(sharingService, 'getSharedFoldersByOwner').mockRejectedValue(new Error('fail'));

      await expect(
        controller.getSharedFolders(user, undefined, 0, 50),
      ).rejects.toThrow('fail');
    });
  });

  describe('getAllSharedFolders', () => {
    it('When getting all shared folders, then it calls service', async () => {
      const expectedResult = { folders: [], files: [], credentials: {}, token: '', role: 'OWNER' };
      jest.spyOn(sharingService, 'getSharedFolders').mockResolvedValue(expectedResult as any);

      const result = await controller.getAllSharedFolders(user, undefined, 0, 50);

      expect(result).toBe(expectedResult);
    });

    it('When orderBy is provided, then it passes order', async () => {
      jest.spyOn(sharingService, 'getSharedFolders').mockResolvedValue({} as any);

      await controller.getAllSharedFolders(user, 'createdAt:DESC' as any, 0, 50);

      expect(sharingService.getSharedFolders).toHaveBeenCalledWith(
        user, 0, 50, [['createdAt', 'DESC']],
      );
    });
  });

  describe('getAllSharedFiles', () => {
    it('When getting all shared files, then it calls service', async () => {
      const expectedResult = { folders: [], files: [], credentials: {}, token: '', role: 'OWNER' };
      jest.spyOn(sharingService, 'getSharedFiles').mockResolvedValue(expectedResult as any);

      const result = await controller.getAllSharedFiles(user, undefined, 0, 50);

      expect(result).toBe(expectedResult);
    });

    it('When orderBy is provided, then it passes order', async () => {
      jest.spyOn(sharingService, 'getSharedFiles').mockResolvedValue({} as any);

      await controller.getAllSharedFiles(user, 'name:ASC' as any, 0, 50);

      expect(sharingService.getSharedFiles).toHaveBeenCalledWith(
        user, 0, 50, [['name', 'ASC']],
      );
    });
  });

  describe('getItemsSharedsWith', () => {
    it('When getting items shared with, then it returns users', async () => {
      const expectedUsers = [{ uuid: 'user-1' }];
      jest.spyOn(sharingService, 'getItemSharedWith').mockResolvedValue(expectedUsers as any);

      const result = await controller.getItemsSharedsWith(user, file.uuid, 'file');

      expect(result).toEqual({ users: expectedUsers });
    });

    it('When service fails, then it fails', async () => {
      jest.spyOn(sharingService, 'getItemSharedWith').mockRejectedValue(new Error('fail'));

      await expect(
        controller.getItemsSharedsWith(user, file.uuid, 'file'),
      ).rejects.toThrow('fail');
    });
  });

  describe('getSharedWithByFolderId', () => {
    it('When getting shared with by folder id, then it returns users', async () => {
      const expectedUsers = [{ uuid: 'user-1' }];
      jest.spyOn(sharingService, 'getSharedWithByItemId').mockResolvedValue(expectedUsers as any);

      const result = await controller.getSharedWithByFolderId(
        user, 0, 50, undefined, folder.uuid,
      );

      expect(result).toEqual({ users: expectedUsers });
    });

    it('When orderBy is provided, then it passes order', async () => {
      jest.spyOn(sharingService, 'getSharedWithByItemId').mockResolvedValue([] as any);

      await controller.getSharedWithByFolderId(
        user, 0, 50, 'createdAt:DESC' as any, folder.uuid,
      );

      expect(sharingService.getSharedWithByItemId).toHaveBeenCalledWith(
        user, folder.uuid, 0, 50, [['createdAt', 'DESC']],
      );
    });

    it('When service fails with a known error, then it fails', async () => {
      jest.spyOn(sharingService, 'getSharedWithByItemId').mockRejectedValue(
        new BadRequestException('test'),
      );

      await expect(
        controller.getSharedWithByFolderId(user, 0, 50, undefined, folder.uuid),
      ).rejects.toThrow(BadRequestException);
    });

    it('When an unexpected error occurs, then it fails', async () => {
      jest.spyOn(sharingService, 'getSharedWithByItemId').mockRejectedValue(new Error('unexpected'));

      await expect(
        controller.getSharedWithByFolderId(user, 0, 50, undefined, folder.uuid),
      ).rejects.toThrow();
    });
  });

  describe('removeUserFromSharedItem', () => {
    it('When removing user from shared item, then it returns success message', async () => {
      jest.spyOn(sharingService, 'removeSharedWith').mockResolvedValue(undefined);

      const result = await controller.removeUserFromSharedItem(
        user.uuid, file.uuid, 'file', user,
      );

      expect(result).toEqual({ message: 'User removed from shared folder' });
      expect(sharingService.removeSharedWith).toHaveBeenCalledWith(
        file.uuid, 'file', user.uuid, user,
      );
    });
  });
});
