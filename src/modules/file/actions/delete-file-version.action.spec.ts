import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DeleteFileVersionAction } from './delete-file-version.action';
import { SequelizeFileVersionRepository } from '../file-version.repository';
import { SequelizeFileRepository } from '../file.repository';
import { FileVersion, FileVersionStatus } from '../file-version.domain';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { newFile, newUser } from '../../../../test/fixtures';

describe('DeleteFileVersionAction', () => {
  let action: DeleteFileVersionAction;
  let fileRepository: SequelizeFileRepository;
  let fileVersionRepository: SequelizeFileVersionRepository;

  const userMocked = newUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteFileVersionAction,
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

    action = module.get<DeleteFileVersionAction>(DeleteFileVersionAction);
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
    it('When file and version exist, then should delete version', async () => {
      const mockFile = newFile({ attributes: { userId: userMocked.id } });
      const versionId = v4();
      const mockVersion = FileVersion.build({
        id: versionId,
        fileId: mockFile.uuid,
        userId: v4(),
        networkFileId: 'network-id',
        size: BigInt(100),
        status: FileVersionStatus.EXISTS,
        sourceLastUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);
      jest
        .spyOn(fileVersionRepository, 'findById')
        .mockResolvedValue(mockVersion);
      jest
        .spyOn(fileVersionRepository, 'updateStatus')
        .mockResolvedValue(undefined);

      await action.execute(userMocked, mockFile.uuid, versionId);

      expect(fileRepository.findByUuid).toHaveBeenCalledWith(
        mockFile.uuid,
        userMocked.id,
        {},
      );
      expect(fileVersionRepository.findById).toHaveBeenCalledWith(versionId);
      expect(fileVersionRepository.updateStatus).toHaveBeenCalledWith(
        versionId,
        FileVersionStatus.DELETED,
      );
    });

    it('When file does not exist, then should fail', async () => {
      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(null);

      await expect(
        action.execute(userMocked, 'non-existent-uuid', v4()),
      ).rejects.toThrow(NotFoundException);
    });

    it('When user does not own file, then should fail', async () => {
      const mockFile = newFile({ attributes: { userId: 999 } });

      jest.spyOn(fileRepository, 'findByUuid').mockResolvedValue(mockFile);

      await expect(
        action.execute(userMocked, mockFile.uuid, v4()),
      ).rejects.toThrow(ForbiddenException);
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
        sourceLastUpdatedAt: new Date(),
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
  });
});
