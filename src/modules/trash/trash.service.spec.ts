import { Test, TestingModule } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import { TrashService } from './trash.service';
import { FileService } from '../file/file.service';
import { FolderService } from '../folder/folder.service';
import { ItemType, MoveItemsToTrashDto } from './dto/move-items-to-trash.dto';

import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';

const fileId = '6295c99a241bb000083f1c6a';
const userId = '1';
const folderId = 4;

// @Module({
//   providers: [
//     {
//       provide: FolderService,
//       useFactory: () => ({ moveFolderToTrash: jest.fn() }),
//     },
//   ],
// })
// class FolderModuleMock {}

// jest.mock('../folder/folder.module', () => {
//   return {
//     FolderModule: {
//       forRootAsync: jest.fn().mockImplementation(() => FolderModuleMock),
//     }
//   }
// })

describe('TrashService', () => {
  let service: TrashService;
  let fileService;
  let folderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // imports: [FolderModule],
      providers: [TrashService],
    }).compile();

    service = module.get<TrashService>(TrashService);
    // fileService = module.get<FileService>(FileService);
    // folderService = module.get<FolderService>(FolderService);
  });

  // describe('addItems', () => {
  //   it('calls addItems with file and return', async () => {
  //     const mockItems: MoveItemsToTrashDto = {
  //       items: [{ id: fileId, type: ItemType.FILE }],
  //     };
  //     // fileService.moveFileToTrash.mockResolvedValue({});
  //     const result = await service.addItems(userId, mockItems);
  //     expect(fileService.moveFileToTrash).toHaveBeenNthCalledWith(
  //       1,
  //       fileId,
  //       userId,
  //     );
  //     expect(folderService.moveFolderToTrash).toHaveBeenCalledTimes(0);
  //     expect(result).toEqual(true);
  //   });

  // it('throws an error if the folder is not found', async () => {
  //   folderRepository.updateByFolderId.mockRejectedValue(
  //     new NotFoundException(),
  //   );
  //   expect(service.moveFolderToTrash(folderId)).rejects.toThrow(
  //     NotFoundException,
  //   );
  // });
  // });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
