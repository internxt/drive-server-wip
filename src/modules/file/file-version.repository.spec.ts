import { createMock } from '@golevelup/ts-jest';
import { SequelizeFileVersionRepository } from './file-version.repository';
import { FileVersionModel } from './file-version.model';
import { FileVersion, FileVersionStatus } from './file-version.domain';
import { newFileVersion } from '../../../test/fixtures';

describe('SequelizeFileVersionRepository', () => {
  let repository: SequelizeFileVersionRepository;
  let fileVersionModel: typeof FileVersionModel;

  beforeEach(() => {
    fileVersionModel = createMock<typeof FileVersionModel>();
    repository = new SequelizeFileVersionRepository(fileVersionModel);
  });

  const createMockModel = (version: FileVersion) => ({
    ...version,
    toJSON: jest.fn().mockReturnValue(version.toJSON()),
  });

  describe('create', () => {
    it('When creating a version, then it should return a FileVersion instance', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockModel as any);

      const result = await repository.create({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status,
      });

      expect(result).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.create).toHaveBeenCalledWith({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status,
      });
    });

    it('When creating a version without status, then it defaults to EXISTS', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockModel as any);

      await repository.create({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
      } as any);

      expect(fileVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: FileVersionStatus.EXISTS,
        }),
      );
    });

    it('When creating a version as deleted, then it creates with deleted status', async () => {
      const version = newFileVersion({
        attributes: { status: FileVersionStatus.DELETED },
      });
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockModel as any);

      const result = await repository.create({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status,
      });

      expect(result.status).toBe(FileVersionStatus.DELETED);
    });

    it('When creating a version with large bigint size, then it handles it correctly', async () => {
      const largeSize = BigInt('9223372036854775807');
      const version = newFileVersion({ attributes: { size: largeSize } });
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockModel as any);

      const result = await repository.create({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status,
      });

      expect(result.size).toBe(largeSize);
    });
  });

  describe('findAllByFileId', () => {
    it('When finding versions by file ID, then it returns versions ordered by creation date', async () => {
      const fileId = 'file-uuid';
      const version1 = newFileVersion({
        attributes: {
          fileId,
          createdAt: new Date('2025-11-11T10:00:00Z'),
        },
      });
      const version2 = newFileVersion({
        attributes: {
          fileId,
          createdAt: new Date('2025-11-11T11:00:00Z'),
        },
      });

      const mockVersions = [version2, version1].map(createMockModel);

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockVersions as any);

      const result = await repository.findAllByFileId(fileId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.findAll).toHaveBeenCalledWith({
        where: {
          fileId,
          status: FileVersionStatus.EXISTS,
        },
        order: [['createdAt', 'DESC']],
      });
    });

    it('When no versions exist for file, then it returns empty array', async () => {
      jest.spyOn(fileVersionModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findAllByFileId('non-existent-file');

      expect(result).toEqual([]);
    });

    it('When finding versions, then it returns only active versions', async () => {
      const fileId = 'file-uuid';
      jest.spyOn(fileVersionModel, 'findAll').mockResolvedValue([]);

      await repository.findAllByFileId(fileId);

      expect(fileVersionModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: FileVersionStatus.EXISTS,
          }),
        }),
      );
    });

    it('When multiple versions exist, then all are returned as FileVersion instances', async () => {
      const fileId = 'file-uuid';
      const versions = [
        newFileVersion({ attributes: { fileId } }),
        newFileVersion({ attributes: { fileId } }),
      ];
      const mockVersions = versions.map(createMockModel);

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockVersions as any);

      const result = await repository.findAllByFileId(fileId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(FileVersion);
      expect(result[1]).toBeInstanceOf(FileVersion);
    });

    it('When searching versions for specific file, then it queries by file', async () => {
      const specificFileId = 'specific-file-uuid-123';
      jest.spyOn(fileVersionModel, 'findAll').mockResolvedValue([]);

      await repository.findAllByFileId(specificFileId);

      expect(fileVersionModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fileId: specificFileId,
          }),
        }),
      );
    });
  });

  describe('upsert', () => {
    it('When upserting a version, then it should return a FileVersion instance', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'upsert')
        .mockResolvedValue([mockModel as any, true]);

      const result = await repository.upsert({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
        status: version.status,
      });

      expect(result).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: version.fileId,
          userId: version.userId,
          networkFileId: version.networkFileId,
          size: version.size,
          status: version.status,
        }),
        { conflictFields: ['file_id', 'network_file_id'] },
      );
    });

    it('When upserting without status, then it defaults to EXISTS', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'upsert')
        .mockResolvedValue([mockModel as any, true]);

      await repository.upsert({
        fileId: version.fileId,
        userId: version.userId,
        networkFileId: version.networkFileId,
        size: version.size,
      } as any);

      expect(fileVersionModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: FileVersionStatus.EXISTS,
        }),
        { conflictFields: ['file_id', 'network_file_id'] },
      );
    });
  });

  describe('findById', () => {
    it('When version exists, then it returns the FileVersion', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'findByPk')
        .mockResolvedValue(mockModel as any);

      const result = await repository.findById(version.id);

      expect(result).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.findByPk).toHaveBeenCalledWith(version.id);
    });

    it('When version does not exist, then it returns null', async () => {
      jest.spyOn(fileVersionModel, 'findByPk').mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('When searching by version identifier, then it uses the correct lookup', async () => {
      const specificId = 'specific-version-id-123';
      jest.spyOn(fileVersionModel, 'findByPk').mockResolvedValue(null);

      await repository.findById(specificId);

      expect(fileVersionModel.findByPk).toHaveBeenCalledWith(specificId);
    });

    it('When deleted version is searched, then it returns the version', async () => {
      const version = newFileVersion({
        attributes: { status: FileVersionStatus.DELETED },
      });
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'findByPk')
        .mockResolvedValue(mockModel as any);

      const result = await repository.findById(version.id);

      expect(result).toBeInstanceOf(FileVersion);
      expect(result?.status).toBe(FileVersionStatus.DELETED);
    });

    it('When version is found, then it converts model to domain with toJSON', async () => {
      const version = newFileVersion();
      const mockModel = createMockModel(version);

      jest
        .spyOn(fileVersionModel, 'findByPk')
        .mockResolvedValue(mockModel as any);

      await repository.findById(version.id);

      expect(mockModel.toJSON).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('When updating status, then it calls model update with correct parameters', async () => {
      const versionId = 'version-id';
      const newStatus = FileVersionStatus.DELETED;

      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([1] as any);

      await repository.updateStatus(versionId, newStatus);

      expect(fileVersionModel.update).toHaveBeenCalledWith(
        { status: newStatus },
        { where: { id: versionId } },
      );
    });

    it('When marking version as deleted, then it updates the status', async () => {
      const versionId = 'version-id';
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([1] as any);

      await repository.updateStatus(versionId, FileVersionStatus.DELETED);

      expect(fileVersionModel.update).toHaveBeenCalledWith(
        { status: FileVersionStatus.DELETED },
        { where: { id: versionId } },
      );
    });

    it('When restoring deleted version, then it updates the status', async () => {
      const versionId = 'version-id';
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([1] as any);

      await repository.updateStatus(versionId, FileVersionStatus.EXISTS);

      expect(fileVersionModel.update).toHaveBeenCalledWith(
        { status: FileVersionStatus.EXISTS },
        { where: { id: versionId } },
      );
    });

    it('When version not found, then it completes without error', async () => {
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([0] as any);

      await expect(
        repository.updateStatus('non-existent-id', FileVersionStatus.DELETED),
      ).resolves.not.toThrow();
    });
  });

  describe('deleteAllByFileId', () => {
    it('When deleting all versions by file ID, then it marks them as DELETED', async () => {
      const fileId = 'file-uuid';

      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([3] as any);

      await repository.deleteAllByFileId(fileId);

      expect(fileVersionModel.update).toHaveBeenCalledWith(
        { status: FileVersionStatus.DELETED },
        { where: { fileId } },
      );
    });

    it('When no versions exist for file, then update returns 0 affected rows', async () => {
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([0] as any);

      await repository.deleteAllByFileId('non-existent-file');

      expect(fileVersionModel.update).toHaveBeenCalled();
    });

    it('When deleting versions for specific file, then it targets that file', async () => {
      const specificFileId = 'specific-file-id-456';
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([2] as any);

      await repository.deleteAllByFileId(specificFileId);

      expect(fileVersionModel.update).toHaveBeenCalledWith(expect.any(Object), {
        where: { fileId: specificFileId },
      });
    });

    it('When deleting all versions, then all are marked as deleted regardless of previous status', async () => {
      const fileId = 'file-uuid';
      jest.spyOn(fileVersionModel, 'update').mockResolvedValue([5] as any);

      await repository.deleteAllByFileId(fileId);

      expect(fileVersionModel.update).toHaveBeenCalledWith(
        { status: FileVersionStatus.DELETED },
        expect.any(Object),
      );
    });
  });

  describe('sumVersionSizeDeltaFromDate', () => {
    it('When user has versions created after sinceDate, then it returns positive delta', async () => {
      const userId = 123;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = [{ total: '2500' }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(result).toBe(2500);
      expect(fileVersionModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
          bind: expect.objectContaining({
            sinceDate,
          }),
          raw: true,
        }),
      );
    });

    it('When user has no versions after sinceDate, then it returns 0', async () => {
      const userId = 456;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = [{ total: null }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(result).toBe(0);
    });

    it('When query returns empty array, then it returns 0', async () => {
      const userId = 789;
      const sinceDate = new Date('2024-01-01T00:00:00Z');

      jest.spyOn(fileVersionModel, 'findAll').mockResolvedValue([] as any);

      const result = await repository.sumVersionSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(result).toBe(0);
    });

    it('When versions were deleted after sinceDate but created before, then it returns negative delta', async () => {
      const userId = 111;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = [{ total: '-1000' }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaFromDate(
        userId,
        sinceDate,
      );

      expect(result).toBe(-1000);
    });
  });

  describe('sumVersionSizeDeltaBetweenDates', () => {
    it('When versions exist in date range, then it returns correct delta', async () => {
      const userId = 123;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const untilDate = new Date('2024-01-31T23:59:59Z');
      const mockResult = [{ total: '3500' }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(result).toBe(3500);
      expect(fileVersionModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
          bind: expect.objectContaining({
            sinceDate,
            untilDate,
          }),
          raw: true,
        }),
      );
    });

    it('When no versions in date range, then it returns 0', async () => {
      const userId = 456;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const untilDate = new Date('2024-01-31T23:59:59Z');
      const mockResult = [{ total: null }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(result).toBe(0);
    });

    it('When query returns empty array, then it returns 0', async () => {
      const userId = 789;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const untilDate = new Date('2024-01-31T23:59:59Z');

      jest.spyOn(fileVersionModel, 'findAll').mockResolvedValue([] as any);

      const result = await repository.sumVersionSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(result).toBe(0);
    });

    it('When version deleted after untilDate but created in range, then it returns positive size', async () => {
      const userId = 111;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const untilDate = new Date('2024-01-31T23:59:59Z');
      const mockResult = [{ total: '1500' }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(result).toBe(1500);
    });

    it('When version created before range but deleted in range, then it returns negative size', async () => {
      const userId = 222;
      const sinceDate = new Date('2024-01-01T00:00:00Z');
      const untilDate = new Date('2024-01-31T23:59:59Z');
      const mockResult = [{ total: '-2000' }];

      jest
        .spyOn(fileVersionModel, 'findAll')
        .mockResolvedValue(mockResult as any);

      const result = await repository.sumVersionSizeDeltaBetweenDates(
        userId,
        sinceDate,
        untilDate,
      );

      expect(result).toBe(-2000);
    });
  });
});
