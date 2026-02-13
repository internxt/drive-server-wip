import { createMock } from '@golevelup/ts-jest';
import { TrashController } from './trash.controller';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { TrashUseCases } from './trash.usecase';
import { newUser, newFile, newFolder } from '../../../test/fixtures';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ItemToTrashType } from './dto/controllers/move-items-to-trash.dto';
import {
  DeleteItemType,
  DeleteItemsDto,
} from './dto/controllers/delete-item.dto';
import { Test } from '@nestjs/testing';
import { FileStatus } from '../file/file.domain';
import { BasicPaginationDto } from '../../common/dto/basic-pagination.dto';
import { v4 } from 'uuid';

const user = newUser();
const requester = newUser();

describe('TrashController', () => {
  let controller: TrashController;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userUseCases: UserUseCases;
  let trashUseCases: TrashUseCases;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TrashController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();
    controller = moduleRef.get(TrashController);
    fileUseCases = moduleRef.get(FileUseCases);
    userUseCases = moduleRef.get(UserUseCases);
    folderUseCases = moduleRef.get(FolderUseCases);
    trashUseCases = moduleRef.get(TrashUseCases);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('moveItemsToTrash', () => {
    it('When item type is invalid, then it should throw', async () => {
      await expect(
        controller.moveItemsToTrash(
          {
            items: [
              {
                uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
                type: 'test' as ItemToTrashType,
              },
            ],
          },
          user,
          undefined,
          'anyid',
          '1.0.0',
          requester,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When array is empty, then it should not call anything', async () => {
      const body = { items: [] };
      jest.spyOn(fileUseCases, 'moveFilesToTrash');

      await controller.moveItemsToTrash(
        body,
        user,
        undefined,
        '',
        '1.0.0',
        requester,
      );
      expect(fileUseCases.moveFilesToTrash).not.toHaveBeenCalled();
    });

    it('When items are passed, then items should be deleted with their respective uuid or id', async () => {
      const fileItems = [
        {
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: ItemToTrashType.FILE,
        },
        {
          id: '2',
          type: ItemToTrashType.FILE,
        },
      ];
      const folderItems = [
        {
          id: '1',
          type: ItemToTrashType.FOLDER,
        },
        {
          uuid: '9af7dca1-fd68-4864-9b60-ef36b77d0903',
          type: ItemToTrashType.FOLDER,
        },
      ];

      jest.spyOn(fileUseCases, 'moveFilesToTrash');
      jest.spyOn(folderUseCases, 'moveFoldersToTrash');
      jest
        .spyOn(userUseCases, 'getWorkspaceMembersByBrigeUser')
        .mockResolvedValue([]);

      await controller.moveItemsToTrash(
        {
          items: [...fileItems, ...folderItems],
        },
        user,
        undefined,
        '',
        '1.0.0',
        requester,
      );

      expect(fileUseCases.moveFilesToTrash).toHaveBeenCalledWith(
        user,
        [fileItems[1].id],
        [fileItems[0].uuid],
        undefined,
      );
      expect(folderUseCases.moveFoldersToTrash).toHaveBeenCalledWith(
        user,
        [parseInt(folderItems[0].id)],
        [folderItems[1].uuid],
        undefined,
      );
    });

    it('When getWorkspaceMembersByBrigeUser fails, then it should handle the error gracefully', async () => {
      const fileItems = [
        {
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: ItemToTrashType.FILE,
        },
      ];

      jest.spyOn(fileUseCases, 'moveFilesToTrash').mockResolvedValue();
      jest.spyOn(folderUseCases, 'moveFoldersToTrash').mockResolvedValue();
      jest
        .spyOn(userUseCases, 'getWorkspaceMembersByBrigeUser')
        .mockRejectedValue(new Error('Workspace error'));

      await expect(
        controller.moveItemsToTrash(
          {
            items: fileItems,
          },
          user,
          undefined,
          'clientId',
          '1.0.0',
          requester,
        ),
      ).resolves.not.toThrow();

      expect(fileUseCases.moveFilesToTrash).toHaveBeenCalled();
    });

    it('When an unexpected error occurs, then it should throw InternalServerErrorException', async () => {
      const fileItems = [
        {
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: ItemToTrashType.FILE,
        },
      ];

      jest
        .spyOn(fileUseCases, 'moveFilesToTrash')
        .mockRejectedValue(new Error('Database error'));
      jest.spyOn(folderUseCases, 'moveFoldersToTrash').mockResolvedValue();

      await expect(
        controller.moveItemsToTrash(
          {
            items: fileItems,
          },
          user,
          undefined,
          'clientId',
          '1.0.0',
          requester,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteItems', () => {
    it('When array is empty, then it should not get items', async () => {
      const deleteItemsDto: DeleteItemsDto = { items: [] };

      await controller.deleteItems(deleteItemsDto, user, 'drive-web', '1.0.0');
      expect(fileUseCases.getFilesByIds).not.toHaveBeenCalled();
      expect(folderUseCases.getFoldersByIds).not.toHaveBeenCalled();
      expect(trashUseCases.deleteItems).toHaveBeenCalled();
    });

    it('When items with UUIDs are passed, then items should be deleted using UUID methods', async () => {
      const fileItems = [
        {
          uuid: v4(),
          type: DeleteItemType.FILE,
        },
      ];
      const folderItems = [
        {
          uuid: v4(),
          type: DeleteItemType.FOLDER,
        },
      ];
      const deleteItemsDto: DeleteItemsDto = {
        items: [...fileItems, ...folderItems],
      };

      jest.spyOn(fileUseCases, 'getFilesByIds').mockResolvedValue([]);
      jest.spyOn(fileUseCases, 'getByUuids').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getFoldersByIds').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getByUuids').mockResolvedValue([]);
      jest.spyOn(trashUseCases, 'deleteItems').mockResolvedValue();

      await controller.deleteItems(deleteItemsDto, user, 'drive-web', '1.0.0');

      expect(fileUseCases.getFilesByIds).not.toHaveBeenCalled();
      expect(fileUseCases.getByUuids).toHaveBeenCalledWith([fileItems[0].uuid]);
      expect(folderUseCases.getFoldersByIds).not.toHaveBeenCalled();
      expect(folderUseCases.getByUuids).toHaveBeenCalledWith([
        folderItems[0].uuid,
      ]);
      expect(trashUseCases.deleteItems).toHaveBeenCalledWith(
        user,
        expect.any(Array),
        expect.any(Array),
      );
    });

    it('When items with IDs are passed, then items should be deleted using ID methods', async () => {
      const fileItems = [
        {
          id: '2',
          type: DeleteItemType.FILE,
        },
      ];
      const folderItems = [
        {
          id: '1',
          type: DeleteItemType.FOLDER,
        },
      ];
      const deleteItemsDto: DeleteItemsDto = {
        items: [...fileItems, ...folderItems],
      };

      jest.spyOn(fileUseCases, 'getFilesByIds').mockResolvedValue([]);
      jest.spyOn(fileUseCases, 'getByUuids').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getFoldersByIds').mockResolvedValue([]);
      jest.spyOn(folderUseCases, 'getByUuids').mockResolvedValue([]);
      jest.spyOn(trashUseCases, 'deleteItems').mockResolvedValue();

      await controller.deleteItems(deleteItemsDto, user, 'drive-web', '1.0.0');

      expect(fileUseCases.getFilesByIds).toHaveBeenCalledWith(user, [
        parseInt(fileItems[0].id),
      ]);
      expect(fileUseCases.getByUuids).not.toHaveBeenCalled();
      expect(folderUseCases.getFoldersByIds).toHaveBeenCalledWith(user, [
        parseInt(folderItems[0].id),
      ]);
      expect(folderUseCases.getByUuids).not.toHaveBeenCalled();
      expect(trashUseCases.deleteItems).toHaveBeenCalledWith(
        user,
        expect.any(Array),
        expect.any(Array),
      );
    });
  });

  describe('getTrashedFilesPaginated', () => {
    const validPagination: BasicPaginationDto = { limit: 10, offset: 0 };

    it('When pagination is missing limit, then it should throw BadRequestException', async () => {
      const invalidPagination = { offset: 0 } as BasicPaginationDto;

      await expect(
        controller.getTrashedFilesPaginated(user, invalidPagination, 'files'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When pagination is missing offset, then it should throw BadRequestException', async () => {
      const invalidPagination = { limit: 10 } as BasicPaginationDto;

      await expect(
        controller.getTrashedFilesPaginated(user, invalidPagination, 'files'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When type is missing, then it should throw BadRequestException', async () => {
      await expect(
        controller.getTrashedFilesPaginated(user, validPagination, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('When type is invalid, then it should throw BadRequestException', async () => {
      await expect(
        controller.getTrashedFilesPaginated(
          user,
          validPagination,
          'invalid' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When limit is less than 1, then it should throw BadRequestException', async () => {
      const invalidPagination = { limit: 0, offset: 0 };

      await expect(
        controller.getTrashedFilesPaginated(user, invalidPagination, 'files'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When limit is greater than 50, then it should throw BadRequestException', async () => {
      const invalidPagination = { limit: 51, offset: 0 };

      await expect(
        controller.getTrashedFilesPaginated(user, invalidPagination, 'files'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When type is files, then it should return trashed files', async () => {
      const mockFiles = [
        newFile({ attributes: { status: FileStatus.TRASHED } }),
      ];
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(mockFiles);
      jest.spyOn(trashUseCases, 'getTrashEntriesByIds').mockResolvedValue([]);

      const result = await controller.getTrashedFilesPaginated(
        user,
        validPagination,
        'files',
      );

      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        user.id,
        { status: FileStatus.TRASHED },
        {
          limit: validPagination.limit,
          offset: validPagination.offset,
          sort: undefined,
        },
      );
      expect(result).toEqual({
        result: mockFiles.map((file) => ({
          ...file.toJSON(),
          caducityDate: null,
        })),
      });
    });

    it('When type is folders, then it should return trashed folders', async () => {
      const mockFolders = [
        newFolder({ attributes: { deleted: true, removed: false } }),
      ];
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue(mockFolders);
      jest.spyOn(trashUseCases, 'getTrashEntriesByIds').mockResolvedValue([]);

      const result = await controller.getTrashedFilesPaginated(
        user,
        validPagination,
        'folders',
      );

      expect(folderUseCases.getFolders).toHaveBeenCalledWith(
        user.id,
        { deleted: true, removed: false },
        {
          limit: validPagination.limit,
          offset: validPagination.offset,
          sort: undefined,
        },
      );
      expect(result).toEqual({
        result: mockFolders.map((folder) => ({
          ...folder.toJSON(),
          caducityDate: null,
        })),
      });
    });

    it('When sort and order are provided for files, then it should include sort in options', async () => {
      const mockFiles = [
        newFile({ attributes: { status: FileStatus.TRASHED } }),
      ];
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue(mockFiles);
      jest.spyOn(trashUseCases, 'getTrashEntriesByIds').mockResolvedValue([]);

      await controller.getTrashedFilesPaginated(
        user,
        validPagination,
        'files',
        'plainName',
        'ASC',
      );

      expect(fileUseCases.getFiles).toHaveBeenCalledWith(
        user.id,
        { status: FileStatus.TRASHED },
        {
          limit: validPagination.limit,
          offset: validPagination.offset,
          sort: [['plainName', 'ASC']],
        },
      );
    });

    it('When fileUseCases throws error, then it should throw InternalServerErrorException', async () => {
      jest
        .spyOn(fileUseCases, 'getFiles')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        controller.getTrashedFilesPaginated(user, validPagination, 'files'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('When folderUseCases throws error, then it should throw InternalServerErrorException', async () => {
      jest
        .spyOn(folderUseCases, 'getFolders')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        controller.getTrashedFilesPaginated(user, validPagination, 'folders'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('clearTrash', () => {
    it('When clearTrash is called, then it should call trashUseCases.emptyTrash', async () => {
      jest.spyOn(trashUseCases, 'emptyTrash').mockResolvedValue({
        message: 'Trashed emptied succesfully',
        status: 'processing',
      });

      await controller.clearTrash(user);

      expect(trashUseCases.emptyTrash).toHaveBeenCalledWith(user);
    });

    it('When emptyTrash throws error, then it should throw InternalServerErrorException', async () => {
      jest
        .spyOn(trashUseCases, 'emptyTrash')
        .mockRejectedValue(new Error('Database error'));

      await expect(controller.clearTrash(user)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('requestEmptyTrash', () => {
    it('When requestEmptyTrash is called, then it should call trashUseCases.emptyTrash', async () => {
      jest.spyOn(trashUseCases, 'emptyTrash').mockResolvedValue({
        message: 'Trashed emptied succesfully',
        status: 'processing',
      });

      await controller.requestEmptyTrash(user);

      expect(trashUseCases.emptyTrash).toHaveBeenCalledWith(user);
    });

    it('When emptyTrash throws error, then it should throw InternalServerErrorException', async () => {
      jest
        .spyOn(trashUseCases, 'emptyTrash')
        .mockRejectedValue(new Error('Database error'));

      await expect(controller.requestEmptyTrash(user)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteFile', () => {
    const fileId = 'test-file-id';

    it('When file exists, then it should delete the file', async () => {
      const mockFile = newFile({ attributes: { fileId } });
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue([mockFile]);
      jest.spyOn(trashUseCases, 'deleteItems').mockResolvedValue();

      await controller.deleteFile(fileId, user);

      expect(fileUseCases.getFiles).toHaveBeenCalledWith(user.id, { fileId });
      expect(trashUseCases.deleteItems).toHaveBeenCalledWith(
        user,
        [mockFile],
        [],
      );
    });

    it('When file does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(fileUseCases, 'getFiles').mockResolvedValue([]);

      await expect(controller.deleteFile(fileId, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteFolder', () => {
    const folderId = 123;

    it('When folder exists, then it should delete the folder', async () => {
      const mockFolder = newFolder({ attributes: { id: folderId } });
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue([mockFolder]);
      jest.spyOn(trashUseCases, 'deleteItems').mockResolvedValue();

      await controller.deleteFolder(folderId, user);

      expect(folderUseCases.getFolders).toHaveBeenCalledWith(user.id, {
        id: folderId,
      });
      expect(trashUseCases.deleteItems).toHaveBeenCalledWith(
        user,
        [],
        [mockFolder],
      );
    });

    it('When folder does not exist, then it should throw NotFoundException', async () => {
      jest.spyOn(folderUseCases, 'getFolders').mockResolvedValue([]);

      await expect(controller.deleteFolder(folderId, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
