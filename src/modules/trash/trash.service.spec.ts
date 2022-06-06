import { Test, TestingModule } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import { TrashService } from './trash.service';
import { FileService } from '../file/file.service';
import { FolderService } from '../folder/folder.service';
import { ItemType, MoveItemsToTrashDto } from './dto/move-items-to-trash.dto';

import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationService } from '../notifications/notification.service';
import { UserService } from '../user/user.service';

const fileId = '6295c99a241bb000083f1c6a';
const user = { id: '1', bridgeUser: '2', rootFolderId: 4 };
const folderId = 4;
const clientId = 'api';

const fileServiceMock = () => ({
  moveFileToTrash: jest.fn(),
  getByFolderAndUser: jest.fn(),
});
const folderServiceMock = () => ({
  moveFolderToTrash: jest.fn(),
  getFolder: jest.fn(),
  getChildrenFoldersToUser: jest.fn(),
});
const notificationServiceMock = () => ({
  add: jest.fn(),
});
const userServiceMock = () => ({
  getWorkspaceMembersByBrigeUser: jest.fn(),
});

describe('TrashService', () => {
  let service: TrashService;
  let fileService;
  let folderService;
  let notificationService;
  let userService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrashService,
        {
          provide: FileService,
          useFactory: fileServiceMock,
        },
        {
          provide: FolderService,
          useFactory: folderServiceMock,
        },
        {
          provide: NotificationService,
          useFactory: notificationServiceMock,
        },
        {
          provide: UserService,
          useFactory: userServiceMock,
        },
      ],
    }).compile();

    service = module.get<TrashService>(TrashService);
    fileService = module.get<FileService>(FileService);
    folderService = module.get<FolderService>(FolderService);
    notificationService = module.get<NotificationService>(NotificationService);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('getTrash', () => {
    it('calls getTrash and return trash', async () => {
      folderService.getFolder.mockResolvedValue({ id: 4, name: 'test' });
      folderService.getChildrenFoldersToUser.mockResolvedValue([]);
      fileService.getByFolderAndUser.mockResolvedValue([]);

      const result = await service.getTrash(user);
      expect(folderService.getFolder).toHaveBeenNthCalledWith(1, folderId);
      expect(folderService.getChildrenFoldersToUser).toHaveBeenNthCalledWith(
        1,
        folderId,
        user.id,
        true,
      );
      expect(fileService.getByFolderAndUser).toHaveBeenNthCalledWith(
        1,
        folderId,
        user.id,
        true,
      );
      expect(result).toEqual({
        id: folderId,
        name: 'test',
        children: [],
        files: [],
      });
    });
  });

  describe('addItems', () => {
    it('calls addItems with file', async () => {
      const mockItems: MoveItemsToTrashDto = {
        items: [{ id: fileId, type: ItemType.FILE }],
      };
      fileService.moveFileToTrash.mockResolvedValue({});
      userService.getWorkspaceMembersByBrigeUser.mockResolvedValue([
        {
          email: 'test',
        },
      ]);
      notificationService.add.mockResolvedValue(true);
      await service.addItems(user, clientId, mockItems);
      expect(fileService.moveFileToTrash).toHaveBeenNthCalledWith(
        1,
        fileId,
        user.id,
      );
      expect(folderService.moveFolderToTrash).toHaveBeenCalledTimes(0);
      expect(
        userService.getWorkspaceMembersByBrigeUser,
      ).toHaveBeenNthCalledWith(1, user.bridgeUser);
      expect(notificationService.add).toHaveBeenCalledTimes(1);
    });

    it('calls addItems with file and folder', async () => {
      const mockItems: MoveItemsToTrashDto = {
        items: [
          { id: fileId, type: ItemType.FILE },
          { id: folderId.toString(), type: ItemType.FOLDER },
        ],
      };
      fileService.moveFileToTrash.mockResolvedValue({});
      userService.getWorkspaceMembersByBrigeUser.mockResolvedValue([
        {
          email: 'test',
        },
      ]);
      notificationService.add.mockResolvedValue(true);
      await service.addItems(user, clientId, mockItems);
      expect(fileService.moveFileToTrash).toHaveBeenNthCalledWith(
        1,
        fileId,
        user.id,
      );
      expect(folderService.moveFolderToTrash).toHaveBeenNthCalledWith(
        1,
        folderId,
      );
      expect(
        userService.getWorkspaceMembersByBrigeUser,
      ).toHaveBeenNthCalledWith(1, user.bridgeUser);
      expect(notificationService.add).toHaveBeenCalledTimes(1);
    });
  });
});
