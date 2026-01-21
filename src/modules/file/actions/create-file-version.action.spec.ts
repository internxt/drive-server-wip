import { Test, TestingModule } from '@nestjs/testing';
import { CreateFileVersionAction } from './create-file-version.action';
import { SequelizeFileRepository } from '../file.repository';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { FeatureLimitService } from '../../feature-limit/feature-limit.service';
import { newFile, newUser } from '../../../../test/fixtures';
import { FileVersion, FileVersionStatus } from '../file-version.domain';

describe('CreateFileVersionAction', () => {
  let action: CreateFileVersionAction;
  let fileRepository: SequelizeFileRepository;
  let fileVersionRepository: SequelizeFileVersionRepository;
  let featureLimitService: FeatureLimitService;

  const userMocked = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateFileVersionAction,
        {
          provide: SequelizeFileRepository,
          useValue: {
            updateByUuidAndUserId: jest.fn(),
          },
        },
        {
          provide: SequelizeFileVersionRepository,
          useValue: {
            create: jest.fn(),
            findAllByFileId: jest.fn(),
            updateStatusBatch: jest.fn(),
          },
        },
        {
          provide: FeatureLimitService,
          useValue: {
            getFileVersioningLimits: jest.fn(),
          },
        },
      ],
    }).compile();

    action = module.get<CreateFileVersionAction>(CreateFileVersionAction);
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    fileVersionRepository = module.get<SequelizeFileVersionRepository>(
      SequelizeFileVersionRepository,
    );
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
  });

  describe('When creating file version without modificationTime', () => {
    it('then should create version and update file', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });

      const newFileId = 'new-file-id';
      const newSize = BigInt(200);

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({
          enabled: true,
          maxFileSize: 1000000,
          retentionDays: 15,
          maxVersions: 10,
        });
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([]);
      jest.spyOn(fileVersionRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      await action.execute(userMocked, mockFile, newFileId, newSize);

      expect(fileVersionRepository.create).toHaveBeenCalledWith({
        fileId: mockFile.uuid,
        userId: userMocked.uuid,
        networkFileId: mockFile.fileId,
        size: mockFile.size,
        status: FileVersionStatus.EXISTS,
      });

      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          fileId: newFileId,
          size: newSize,
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('When creating file version with modificationTime', () => {
    it('then should create version and update file with modificationTime', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });

      const newFileId = 'new-file-id';
      const newSize = BigInt(200);
      const modificationTime = new Date();

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({
          enabled: true,
          maxFileSize: 1000000,
          retentionDays: 15,
          maxVersions: 10,
        });
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([]);
      jest.spyOn(fileVersionRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      await action.execute(
        userMocked,
        mockFile,
        newFileId,
        newSize,
        modificationTime,
      );

      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          fileId: newFileId,
          size: newSize,
          modificationTime,
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('When retention policy needs to delete old versions', () => {
    it('then should delete versions older than retention period', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);

      const existingVersions = [
        FileVersion.build({
          id: 'version-1',
          fileId: mockFile.uuid,
          userId: userMocked.uuid,
          networkFileId: 'network-1',
          size: BigInt(50),
          status: FileVersionStatus.EXISTS,
          createdAt: oldDate,
          updatedAt: oldDate,
        }),
      ];

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({
          enabled: true,
          maxFileSize: 1000000,
          retentionDays: 15,
          maxVersions: 10,
        });
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(existingVersions);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();
      jest.spyOn(fileVersionRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      await action.execute(userMocked, mockFile, 'new-file-id', BigInt(200));

      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        ['version-1'],
        FileVersionStatus.DELETED,
      );
    });
  });

  describe('When versions exist within retention period and under limit', () => {
    it('then should not delete any versions', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });

      const now = new Date();
      const existingVersions = [
        FileVersion.build({
          id: 'version-1',
          fileId: mockFile.uuid,
          userId: userMocked.uuid,
          networkFileId: 'network-1',
          size: BigInt(50),
          status: FileVersionStatus.EXISTS,
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: now,
        }),
        FileVersion.build({
          id: 'version-2',
          fileId: mockFile.uuid,
          userId: userMocked.uuid,
          networkFileId: 'network-2',
          size: BigInt(50),
          status: FileVersionStatus.EXISTS,
          createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          updatedAt: now,
        }),
      ];

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({
          enabled: true,
          maxFileSize: 1000000,
          retentionDays: 15,
          maxVersions: 10,
        });
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(existingVersions);
      const updateStatusBatchSpy = jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();
      jest.spyOn(fileVersionRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      await action.execute(userMocked, mockFile, 'new-file-id', BigInt(200));

      expect(updateStatusBatchSpy).not.toHaveBeenCalled();
      expect(fileVersionRepository.create).toHaveBeenCalled();
    });
  });

  describe('When max versions limit is reached', () => {
    it('then should delete oldest versions exceeding the limit', async () => {
      const mockFile = newFile({
        attributes: {
          fileId: 'old-file-id',
          bucket: 'test-bucket',
          type: 'pdf',
          size: BigInt(100),
        },
      });

      const now = new Date();
      const existingVersions = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        return FileVersion.build({
          id: `version-${i}`,
          fileId: mockFile.uuid,
          userId: userMocked.uuid,
          networkFileId: `network-${i}`,
          size: BigInt(50),
          status: FileVersionStatus.EXISTS,
          createdAt: date,
          updatedAt: date,
        });
      });

      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue({
          enabled: true,
          maxFileSize: 1000000,
          retentionDays: 15,
          maxVersions: 10,
        });
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(existingVersions);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue();
      jest.spyOn(fileVersionRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(fileRepository, 'updateByUuidAndUserId').mockResolvedValue();

      await action.execute(userMocked, mockFile, 'new-file-id', BigInt(200));

      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        expect.arrayContaining(['version-10', 'version-11']),
        FileVersionStatus.DELETED,
      );
    });
  });
});
