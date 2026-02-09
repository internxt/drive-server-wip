import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { GetFileVersionsAction } from './get-file-versions.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { FeatureLimitService } from '../../feature-limit/feature-limit.service';
import { FileVersion, FileVersionStatus } from '../file-version.domain';
import { NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import {
  newFile,
  newUser,
  newVersioningLimits,
} from '../../../../test/fixtures';

describe('GetFileVersionsAction', () => {
  let action: GetFileVersionsAction;
  let fileRepository: SequelizeFileRepository;
  let fileVersionRepository: SequelizeFileVersionRepository;
  let featureLimitService: FeatureLimitService;

  const userMocked = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFileVersionsAction,
        {
          provide: SequelizeFileRepository,
          useValue: createMock<SequelizeFileRepository>(),
        },
        {
          provide: SequelizeFileVersionRepository,
          useValue: createMock<SequelizeFileVersionRepository>(),
        },
        {
          provide: FeatureLimitService,
          useValue: createMock<FeatureLimitService>(),
        },
      ],
    }).compile();

    action = module.get<GetFileVersionsAction>(GetFileVersionsAction);
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    fileVersionRepository = module.get<SequelizeFileVersionRepository>(
      SequelizeFileVersionRepository,
    );
    featureLimitService = module.get<FeatureLimitService>(FeatureLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(action).toBeDefined();
  });

  describe('execute', () => {
    const mockLimits = newVersioningLimits({ retentionDays: 30 });

    it('When file exists, then it should return file versions', async () => {
      const mockFile = newFile();
      const createdAt = new Date('2025-01-01');
      const mockVersions = [
        FileVersion.build({
          id: v4(),
          fileId: mockFile.uuid,
          userId: v4(),
          networkFileId: 'network-1',
          size: BigInt(100),
          status: FileVersionStatus.EXISTS,
          sourceLastUpdatedAt: mockFile.updatedAt,
          createdAt,
          updatedAt: new Date(),
        }),
      ];

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue(mockVersions);
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(mockLimits);

      const result = await action.execute(userMocked, mockFile.uuid);

      const expectedExpiresAt = new Date(createdAt);
      expectedExpiresAt.setDate(
        expectedExpiresAt.getDate() + mockLimits.retentionDays,
      );

      expect(result[0].expiresAt).toEqual(expectedExpiresAt);
      expect(result[0].id).toEqual(mockVersions[0].id);
      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {},
      );
      expect(fileVersionRepository.findAllByFileId).toHaveBeenCalledWith(
        mockFile.uuid,
      );
    });

    it('When file exists but has no versions, then it should return empty array', async () => {
      const mockFile = newFile();

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([]);
      jest
        .spyOn(featureLimitService, 'getFileVersioningLimits')
        .mockResolvedValue(mockLimits);

      const result = await action.execute(userMocked, mockFile.uuid);

      expect(result).toEqual([]);
      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {},
      );
      expect(fileVersionRepository.findAllByFileId).toHaveBeenCalledWith(
        mockFile.uuid,
      );
    });

    it('When file does not exist, then should fail', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        action.execute(userMocked, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);

      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        'non-existent-uuid',
        userMocked.id,
        {},
      );
    });
  });
});
