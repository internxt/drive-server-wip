import { createMock } from '@golevelup/ts-jest';
import { TrashController } from './trash.controller';
import { FileUseCases } from '../storage/file/file.usecase';
import { FolderUseCases } from '../storage/folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { TrashUseCases } from './trash.usecase';
import { newUser } from '../../../test/fixtures';
import { BadRequestException, Logger } from '@nestjs/common';
import { ItemType } from './dto/controllers/move-items-to-trash.dto';
import {
  DeleteItemType,
  DeleteItemsDto,
} from './dto/controllers/delete-item.dto';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Test } from '@nestjs/testing';

const user = newUser();
const requester = newUser();

describe('TrashController', () => {
  let controller: TrashController;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userUseCases: UserUseCases;
  let trashUseCases: TrashUseCases;
  let storageNotificationService: StorageNotificationService;

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
    storageNotificationService = moduleRef.get(StorageNotificationService);
    folderUseCases = moduleRef.get(FolderUseCases);
    trashUseCases = moduleRef.get(TrashUseCases);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('When item type is invalid, then it should throw', async () => {
    await expect(
      controller.moveItemsToTrash(
        {
          items: [
            {
              uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
              type: 'test' as ItemType,
            },
          ],
        },
        user,
        'anyid',
        requester,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('When array is empty, then it should not call anything', async () => {
    const body = { items: [] };
    jest.spyOn(fileUseCases, 'moveFilesToTrash');

    await controller.moveItemsToTrash(body, user, '', requester);
    expect(fileUseCases.moveFilesToTrash).not.toHaveBeenCalled();
  });

  it('When items are passed, then items should be deleted with their respective uuid or id', async () => {
    const fileItems = [
      {
        uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
        type: ItemType.FILE,
      },
      {
        id: '2',
        type: ItemType.FILE,
      },
    ];
    const folderItems = [
      {
        id: '1',
        type: ItemType.FOLDER,
      },
      {
        uuid: '9af7dca1-fd68-4864-9b60-ef36b77d0903',
        type: ItemType.FOLDER,
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
      '',
      requester,
    );

    expect(fileUseCases.moveFilesToTrash).toHaveBeenCalledWith(
      user,
      [fileItems[1].id],
      [fileItems[0].uuid],
    );
    expect(folderUseCases.moveFoldersToTrash).toHaveBeenCalledWith(
      user,
      [parseInt(folderItems[0].id)],
      [folderItems[1].uuid],
    );
  });

  describe('deleteItems', () => {
    it('When array is empty, then it should not get items', async () => {
      const deleteItemsDto: DeleteItemsDto = { items: [] };

      await controller.deleteItems(deleteItemsDto, user);
      expect(fileUseCases.getFilesByIds).not.toHaveBeenCalled();
      expect(folderUseCases.getFoldersByIds).not.toHaveBeenCalled();
      expect(trashUseCases.deleteItems).toHaveBeenCalled();
    });

    it('When items are passed, then items should be deleted with their respective uuid or id', async () => {
      const fileItems = [
        {
          id: '2',
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: DeleteItemType.FILE,
        },
      ];
      const folderItems = [
        {
          id: '1',
          uuid: '9af7dca1-fd68-4864-9b60-ef36b77d0903',
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

      await controller.deleteItems(deleteItemsDto, user);

      expect(fileUseCases.getFilesByIds).toHaveBeenCalledWith(user, [
        parseInt(fileItems[0].id),
      ]);
      expect(fileUseCases.getByUuids).toHaveBeenCalledWith([fileItems[0].uuid]);
      expect(folderUseCases.getFoldersByIds).toHaveBeenCalledWith(user, [
        parseInt(folderItems[0].id),
      ]);
      expect(folderUseCases.getByUuids).toHaveBeenCalledWith([
        folderItems[0].uuid,
      ]);
      expect(trashUseCases.deleteItems).toHaveBeenCalledWith(
        user,
        expect.any(Array),
        expect.any(Array),
      );
    });
  });
});
