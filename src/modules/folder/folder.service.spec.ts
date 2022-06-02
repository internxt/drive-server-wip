import { Test, TestingModule } from '@nestjs/testing';
import { FolderService } from './folder.service';
import {
  SequelizeFolderRepository,
  FolderRepository,
} from './folder.repository';
import { NotFoundException } from '@nestjs/common';

const mockFolderRepository = () => ({
  updateByFolderId: jest.fn(),
});

const folderId = 4;
describe('FolderService', () => {
  let service: FolderService;
  let folderRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FolderService,
        {
          provide: SequelizeFolderRepository,
          useFactory: mockFolderRepository,
        },
      ],
    }).compile();

    service = module.get<FolderService>(FolderService);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
  });

  describe('moveFolderToTrash', () => {
    it('calls moveFolderToTrash and return file', async () => {
      const mockFolder = {
        id: folderId,
        deleted: true,
      };
      folderRepository.updateByFolderId.mockResolvedValue(mockFolder);
      const result = await service.moveFolderToTrash(folderId);
      expect(result).toEqual(mockFolder);
    });

    it('throws an error if the folder is not found', async () => {
      folderRepository.updateByFolderId.mockRejectedValue(
        new NotFoundException(),
      );
      expect(service.moveFolderToTrash(folderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
