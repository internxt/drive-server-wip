import { createMock } from '@golevelup/ts-jest';
import { TrashController } from './trash.controller';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { TrashUseCases } from './trash.usecase';
import { NotificationService } from '../../externals/notifications/notification.service';
import { newUser } from '../../../test/fixtures';
import { BadRequestException } from '@nestjs/common';
import { ItemType } from './dto/controllers/move-items-to-trash.dto';

const user = newUser();

describe('TrashController', () => {
  let controller: TrashController;
  let folderUseCases: FolderUseCases;
  let fileUseCases: FileUseCases;
  let userUseCases: UserUseCases;
  let trashUseCases: TrashUseCases;
  let notificationService: NotificationService;

  beforeEach(async () => {
    folderUseCases = createMock<FolderUseCases>();
    fileUseCases = createMock<FileUseCases>();
    userUseCases = createMock<UserUseCases>();
    trashUseCases = createMock<TrashUseCases>();
    notificationService = createMock<NotificationService>();
    controller = new TrashController(
      fileUseCases,
      folderUseCases,
      userUseCases,
      notificationService,
      trashUseCases,
    );
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
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('When array is empty, then it should not call anything', async () => {
    const body = { items: [] };
    jest.spyOn(fileUseCases, 'moveFilesToTrash');

    await controller.moveItemsToTrash(body, user, '');
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
});
