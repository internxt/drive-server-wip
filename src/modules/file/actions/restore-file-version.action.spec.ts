import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { RestoreFileVersionAction } from './restore-file-version.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { FileVersion, FileVersionStatus } from '../file-version.domain';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newUser } from '../../../../test/fixtures';

describe('RestoreFileVersionAction', () => {
  let action: RestoreFileVersionAction;
  let fileRepository: SequelizeFileRepository;
  let fileVersionRepository: SequelizeFileVersionRepository;

  const userMocked = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreFileVersionAction,
        {
          provide: SequelizeFileRepository,
          useValue: createMock<SequelizeFileRepository>(),
        },
        {
          provide: SequelizeFileVersionRepository,
          useValue: createMock<SequelizeFileVersionRepository>(),
        },
      ],
    }).compile();

    action = module.get<RestoreFileVersionAction>(RestoreFileVersionAction);
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    fileVersionRepository = module.get<SequelizeFileVersionRepository>(
      SequelizeFileVersionRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(action).toBeDefined();
  });

  describe('execute', () => {
    it('When restoring a version, then should restore file to that version and delete newer versions', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const olderDate = new Date('2024-01-01');
      const newerDate = new Date('2024-01-02');

      const versionToRestore = FileVersion.build({
        id: versionId,
        fileId: mockFile.uuid,
        userId: v4(),
        networkFileId: 'network-id-v1',
        size: BigInt(100),
        status: FileVersionStatus.EXISTS,
        createdAt: olderDate,
        updatedAt: olderDate,
      });

      const newerVersion = FileVersion.build({
        id: v4(),
        fileId: mockFile.uuid,
        userId: v4(),
        networkFileId: 'network-id-v2',
        size: BigInt(200),
        status: FileVersionStatus.EXISTS,
        createdAt: newerDate,
        updatedAt: newerDate,
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(versionToRestore);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([versionToRestore, newerVersion]);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);
      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValue(undefined);

      const result = await action.execute(userMocked, mockFile.uuid, versionId);

      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {},
      );
      expect(fileVersionRepository.findById).toHaveBeenCalledWith(versionId);
      expect(fileVersionRepository.findAllByFileId).toHaveBeenCalledWith(
        mockFile.uuid,
      );
      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        [newerVersion.id, versionId],
        FileVersionStatus.DELETED,
      );
      expect(fileRepository.updateByUuidAndUserId).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        expect.objectContaining({
          fileId: 'network-id-v1',
          size: BigInt(100),
        }),
      );
      expect(result.fileId).toBe('network-id-v1');
      expect(result.size).toBe(BigInt(100));
    });

    it('When file does not exist, then should fail', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        action.execute(userMocked, 'non-existent-uuid', v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not exist, then should fail', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest.spyOn(fileVersionRepository, 'findById').mockResolvedValue(null);

      await expect(
        action.execute(userMocked, mockFile.uuid, v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When version does not belong to file, then should fail', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const mockVersion = FileVersion.build({
        id: versionId,
        fileId: 'different-file-uuid',
        userId: v4(),
        networkFileId: 'network-id',
        size: BigInt(100),
        status: FileVersionStatus.EXISTS,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);

      await expect(
        action.execute(userMocked, mockFile.uuid, versionId),
      ).rejects.toThrow(ConflictException);
    });

    it('When trying to restore a deleted version, then should fail', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const deletedVersion = FileVersion.build({
        id: versionId,
        fileId: mockFile.uuid,
        userId: v4(),
        networkFileId: 'network-id',
        size: BigInt(100),
        status: FileVersionStatus.DELETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(deletedVersion);

      await expect(
        action.execute(userMocked, mockFile.uuid, versionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('When restoring oldest version, then should only delete the version itself', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const oldestDate = new Date('2024-01-01');

      const versionToRestore = FileVersion.build({
        id: versionId,
        fileId: mockFile.uuid,
        userId: v4(),
        networkFileId: 'network-id-v0',
        size: BigInt(50),
        status: FileVersionStatus.EXISTS,
        createdAt: oldestDate,
        updatedAt: oldestDate,
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(versionToRestore);
      jest
        .spyOn(fileVersionRepository, 'findAllByFileId')
        .mockResolvedValue([versionToRestore]);
      jest
        .spyOn(fileVersionRepository, 'updateStatusBatch')
        .mockResolvedValue(undefined);
      jest
        .spyOn(fileRepository, 'updateByUuidAndUserId')
        .mockResolvedValue(undefined);

      await action.execute(userMocked, mockFile.uuid, versionId);

      expect(fileVersionRepository.updateStatusBatch).toHaveBeenCalledWith(
        [versionId],
        FileVersionStatus.DELETED,
      );
    });
  });
});
