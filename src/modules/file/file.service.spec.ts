import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from './file.service';
import { SequelizeFileRepository, FileRepository } from './file.repository';
import { NotFoundException } from '@nestjs/common';

const mockFileRepository = () => ({
  updateByFieldIdAndUserId: jest.fn(),
});

const fileId = '6295c99a241bb000083f1c6a';
const userId = '1';
describe('FileService', () => {
  let service: FileService;
  let fileRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: SequelizeFileRepository,
          useFactory: mockFileRepository,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
    fileRepository = module.get<FileRepository>(SequelizeFileRepository);
  });

  describe('moveFileToTrash', () => {
    it('calls moveFileToTrash and return file', async () => {
      const mockFile = {
        fileId,
        userId,
        deleted: true,
      };
      fileRepository.updateByFieldIdAndUserId.mockResolvedValue(mockFile);
      const result = await service.moveFileToTrash(fileId, userId);
      expect(result).toEqual(mockFile);
    });

    it('throws an error if the note is not found', async () => {
      fileRepository.updateByFieldIdAndUserId.mockRejectedValue(
        new NotFoundException(),
      );
      expect(service.moveFileToTrash(fileId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
