import { createMock } from '@golevelup/ts-jest';
import { SequelizeFileVersionRepository } from './file-version.repository';
import { FileVersionModel } from './file-version.model';
import { FileVersion, FileVersionStatus } from './file-version.domain';

describe('SequelizeFileVersionRepository', () => {
  let repository: SequelizeFileVersionRepository;
  let fileVersionModel: typeof FileVersionModel;

  beforeEach(() => {
    fileVersionModel = createMock<typeof FileVersionModel>();
    repository = new SequelizeFileVersionRepository(fileVersionModel);
  });

  describe('create', () => {
    it('When creating a version, then it should return a FileVersion instance', async () => {
      const versionData = {
        fileId: 'file-uuid',
        networkFileId: 'network-id',
        size: BigInt(1024),
        status: FileVersionStatus.EXISTS,
      };

      const mockCreatedVersion = {
        id: 'version-id',
        ...versionData,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: jest.fn().mockReturnValue({
          id: 'version-id',
          ...versionData,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockCreatedVersion as any);

      const result = await repository.create(versionData);

      expect(result).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.create).toHaveBeenCalledWith({
        fileId: versionData.fileId,
        networkFileId: versionData.networkFileId,
        size: versionData.size,
        status: versionData.status,
      });
    });

    it('When creating a version without status, then it defaults to EXISTS', async () => {
      const versionData = {
        fileId: 'file-uuid',
        networkFileId: 'network-id',
        size: BigInt(1024),
      };

      const mockCreatedVersion = {
        id: 'version-id',
        ...versionData,
        status: FileVersionStatus.EXISTS,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: jest.fn().mockReturnValue({
          id: 'version-id',
          ...versionData,
          status: FileVersionStatus.EXISTS,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      jest
        .spyOn(fileVersionModel, 'create')
        .mockResolvedValue(mockCreatedVersion as any);

      await repository.create(versionData as any);

      expect(fileVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: FileVersionStatus.EXISTS,
        }),
      );
    });
  });

  describe('findAllByFileId', () => {
    it('When finding versions by file ID, then it returns versions ordered by creation date', async () => {
      const fileId = 'file-uuid';
      const mockVersions = [
        {
          id: 'version-2',
          fileId,
          networkFileId: 'network-2',
          size: BigInt(2048),
          status: FileVersionStatus.EXISTS,
          createdAt: new Date('2025-11-11T11:00:00Z'),
          updatedAt: new Date('2025-11-11T11:00:00Z'),
          toJSON: jest.fn().mockReturnValue({
            id: 'version-2',
            fileId,
            networkFileId: 'network-2',
            size: BigInt(2048),
            status: FileVersionStatus.EXISTS,
            createdAt: new Date('2025-11-11T11:00:00Z'),
            updatedAt: new Date('2025-11-11T11:00:00Z'),
          }),
        },
        {
          id: 'version-1',
          fileId,
          networkFileId: 'network-1',
          size: BigInt(1024),
          status: FileVersionStatus.EXISTS,
          createdAt: new Date('2025-11-11T10:00:00Z'),
          updatedAt: new Date('2025-11-11T10:00:00Z'),
          toJSON: jest.fn().mockReturnValue({
            id: 'version-1',
            fileId,
            networkFileId: 'network-1',
            size: BigInt(1024),
            status: FileVersionStatus.EXISTS,
            createdAt: new Date('2025-11-11T10:00:00Z'),
            updatedAt: new Date('2025-11-11T10:00:00Z'),
          }),
        },
      ];

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
  });

  describe('findById', () => {
    it('When version exists, then it returns the FileVersion', async () => {
      const versionId = 'version-id';
      const mockVersion = {
        id: versionId,
        fileId: 'file-uuid',
        networkFileId: 'network-id',
        size: BigInt(1024),
        status: FileVersionStatus.EXISTS,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: jest.fn().mockReturnValue({
          id: versionId,
          fileId: 'file-uuid',
          networkFileId: 'network-id',
          size: BigInt(1024),
          status: FileVersionStatus.EXISTS,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      jest
        .spyOn(fileVersionModel, 'findByPk')
        .mockResolvedValue(mockVersion as any);

      const result = await repository.findById(versionId);

      expect(result).toBeInstanceOf(FileVersion);
      expect(fileVersionModel.findByPk).toHaveBeenCalledWith(versionId);
    });

    it('When version does not exist, then it returns null', async () => {
      jest.spyOn(fileVersionModel, 'findByPk').mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
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
  });
});
