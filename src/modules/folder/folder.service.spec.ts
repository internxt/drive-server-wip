import { Test, TestingModule } from '@nestjs/testing';
import { FolderService } from './folder.service';
import {
  SequelizeFolderRepository,
  FolderRepository,
} from './folder.repository';
import { NotFoundException } from '@nestjs/common';
import { CryptoService } from '../../services/crypto/crypto.service';

const mockFolderRepository = () => ({
  findById: jest.fn(),
  findAllByParentIdAndUserId: jest.fn(),
  updateByFolderId: jest.fn(),
});

const mockCryptoService = () => ({
  decryptName: jest.fn(),
});

const folderId = 4;
const userId = '1';
describe('FolderService', () => {
  let service: FolderService;
  let folderRepository;
  let cryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FolderService,
        {
          provide: SequelizeFolderRepository,
          useFactory: mockFolderRepository,
        },
        {
          provide: CryptoService,
          useFactory: mockCryptoService,
        },
      ],
    }).compile();

    service = module.get<FolderService>(FolderService);
    folderRepository = module.get<FolderRepository>(SequelizeFolderRepository);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

  describe('getFolder', () => {
    it('calls getFolder and return folder', async () => {
      const mockFolder = {
        id: 4,
        toJSON: () => {
          return { id: 4 };
        },
      };
      folderRepository.findById.mockResolvedValue(mockFolder);
      const result = await service.getFolder(folderId);
      expect(result).toEqual({ id: 4 });
      expect(folderRepository.findById).toHaveBeenNthCalledWith(1, folderId);
      expect(cryptoService.decryptName).not.toHaveBeenCalled();
    });

    it('throws an error if the folder is not found', async () => {
      folderRepository.findById.mockResolvedValue(null);
      expect(service.getFolder(folderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChildrenFoldersToUser', () => {
    it('calls getChildrenFoldersToUser and return empty folders', async () => {
      const mockFolders = [];
      folderRepository.findAllByParentIdAndUserId.mockResolvedValue([]);
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userId,
        false,
      );
      expect(result).toEqual(mockFolders);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userId, false);
      expect(cryptoService.decryptName).not.toHaveBeenCalled();
    });

    it('calls getChildrenFoldersToUser and return folders', async () => {
      const mockFolders = [
        {
          id: 4,
          name: 'test',
          toJSON: () => {
            return { id: 4, name: 'test' };
          },
        },
      ];
      folderRepository.findAllByParentIdAndUserId.mockResolvedValue(
        mockFolders,
      );
      const result = await service.getChildrenFoldersToUser(
        folderId,
        userId,
        false,
      );
      expect(result).toEqual([{ id: 4, name: 'test' }]);
      expect(
        folderRepository.findAllByParentIdAndUserId,
      ).toHaveBeenNthCalledWith(1, folderId, userId, false);
      expect(cryptoService.decryptName).toHaveBeenNthCalledWith(
        1,
        'test',
        folderId,
      );
    });
  });
});
