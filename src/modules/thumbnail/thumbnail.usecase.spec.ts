import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ThumbnailUseCases } from './thumbnail.usecase';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { newUser } from './../../../test/fixtures';
import { CreateThumbnailDto } from './dto/create-thumbnail.dto';
import { createMock } from '@golevelup/ts-jest';
import { SequelizeFileRepository } from '../file/file.repository';
import { v4 } from 'uuid';

describe('ThumbnailUseCases', () => {
  let thumbnailUseCases: ThumbnailUseCases;
  let thumbnailRepository: SequelizeThumbnailRepository;
  let fileRepository: SequelizeFileRepository;
  let networkService: BridgeService;

  const userMocked = newUser();
  const fileUuid = v4();

  const createThumbnailDto: CreateThumbnailDto = {
    fileUuid: fileUuid,
    bucketId: 'bucketId',
  } as any;

  const existingThumbnail = {
    id: 1,
    fileId: 123456,
    fileUuid: fileUuid,
    bucketId: 'oldBucketId',
    bucketFile: 'existingBucketFile',
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThumbnailUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    thumbnailUseCases = module.get<ThumbnailUseCases>(ThumbnailUseCases);
    thumbnailRepository = module.get<SequelizeThumbnailRepository>(
      SequelizeThumbnailRepository,
    );
    fileRepository = module.get<SequelizeFileRepository>(
      SequelizeFileRepository,
    );
    networkService = module.get<BridgeService>(BridgeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createThumbnail', () => {
    beforeEach(() => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue({
        id: 123456,
        uuid: fileUuid,
        userId: userMocked.id,
        bucket: 'fileBucketId',
      } as any);
    });

    it('When a new thumbnail is created, then it should return the created thumbnail', async () => {
      jest.spyOn(thumbnailRepository, 'findByFileUuid').mockResolvedValue(null);
      jest
        .spyOn(thumbnailRepository, 'create')
        .mockResolvedValue(existingThumbnail);

      const result = await thumbnailUseCases.createThumbnail(
        userMocked,
        createThumbnailDto,
      );

      expect(thumbnailRepository.findByFileUuid).toHaveBeenCalledWith(fileUuid);
      expect(thumbnailRepository.create).toHaveBeenCalledWith({
        ...createThumbnailDto,
        bucketId: 'fileBucketId',
        fileId: 123456,
        fileUuid: fileUuid,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(existingThumbnail);
    });

    it('When an existing thumbnail is found, then it should delete the existing thumbnail and update it', async () => {
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      jest.spyOn(networkService, 'deleteFile').mockResolvedValue(undefined);
      jest
        .spyOn(thumbnailRepository, 'update')
        .mockResolvedValue(existingThumbnail);
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);

      const result = await thumbnailUseCases.createThumbnail(
        userMocked,
        createThumbnailDto,
      );

      expect(networkService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        existingThumbnail.bucketId,
        existingThumbnail.bucketFile,
      );
      expect(thumbnailRepository.update).toHaveBeenCalledWith(
        { ...createThumbnailDto, bucketId: 'fileBucketId' },
        {
          id: existingThumbnail.id,
          fileUuid: existingThumbnail.fileUuid,
        },
      );
      expect(result).toEqual(existingThumbnail);
    });

    it('When an error occurs while deleting the existing thumbnail, it should log the error but continue', async () => {
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      jest
        .spyOn(networkService, 'deleteFile')
        .mockRejectedValue(new Error('Delete error'));
      jest
        .spyOn(thumbnailRepository, 'update')
        .mockResolvedValue(existingThumbnail);
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      const consoleErrorSpy = jest
        .spyOn(Logger, 'error')
        .mockImplementation(() => {});

      const result = await thumbnailUseCases.createThumbnail(
        userMocked,
        createThumbnailDto,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting existent thumbnail'),
      );
      expect(thumbnailRepository.update).toHaveBeenCalledWith(
        { ...createThumbnailDto, bucketId: 'fileBucketId' },
        {
          id: existingThumbnail.id,
          fileUuid: existingThumbnail.fileUuid,
        },
      );
      expect(result).toEqual(existingThumbnail);
    });

    it('When file bucket differs from DTO bucket, it should use file bucket for thumbnail', async () => {
      const dtoWithDifferentBucket = {
        ...createThumbnailDto,
        bucketId: 'dtoBucketId',
      };

      jest.spyOn(thumbnailRepository, 'findByFileUuid').mockResolvedValue(null);
      jest
        .spyOn(thumbnailRepository, 'create')
        .mockResolvedValue(existingThumbnail);

      await thumbnailUseCases.createThumbnail(
        userMocked,
        dtoWithDifferentBucket,
      );

      expect(thumbnailRepository.create).toHaveBeenCalledWith({
        ...dtoWithDifferentBucket,
        bucketId: 'fileBucketId',
        fileId: 123456,
        fileUuid: fileUuid,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('When existing thumbnail has different bucket than file, it should delete from old bucket and update with file bucket', async () => {
      const dtoWithDifferentBucket = {
        ...createThumbnailDto,
        bucketId: 'dtoBucketId',
      };

      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      jest.spyOn(networkService, 'deleteFile').mockResolvedValue(undefined);
      jest
        .spyOn(thumbnailRepository, 'update')
        .mockResolvedValue(existingThumbnail);
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);

      await thumbnailUseCases.createThumbnail(
        userMocked,
        dtoWithDifferentBucket,
      );

      expect(networkService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        existingThumbnail.bucketId,
        existingThumbnail.bucketFile,
      );
      expect(thumbnailRepository.update).toHaveBeenCalledWith(
        { ...dtoWithDifferentBucket, bucketId: 'fileBucketId' },
        {
          id: existingThumbnail.id,
          fileUuid: existingThumbnail.fileUuid,
        },
      );
    });

    it('When an error occurs while creating a new thumbnail, it should handle the error', async () => {
      jest.spyOn(thumbnailRepository, 'findByFileUuid').mockResolvedValue(null);
      jest
        .spyOn(thumbnailRepository, 'create')
        .mockRejectedValue(new Error('Creation error'));

      await expect(
        thumbnailUseCases.createThumbnail(userMocked, createThumbnailDto),
      ).rejects.toThrow('Creation error');
    });

    it('When the file is not found, it should throw a NotFoundException', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue(null);

      await expect(
        thumbnailUseCases.createThumbnail(userMocked, createThumbnailDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When the user does not own the file, it should throw a ForbiddenException', async () => {
      jest.spyOn(fileRepository, 'findOneBy').mockResolvedValue({
        id: 123456,
        uuid: fileUuid,
        userId: 'differentUserId',
      } as any);

      await expect(
        thumbnailUseCases.createThumbnail(userMocked, createThumbnailDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('When the file exists and belongs to the user, it should proceed with thumbnail creation', async () => {
      jest.spyOn(thumbnailRepository, 'findByFileUuid').mockResolvedValue(null);
      jest
        .spyOn(thumbnailRepository, 'create')
        .mockResolvedValue(existingThumbnail);

      const result = await thumbnailUseCases.createThumbnail(
        userMocked,
        createThumbnailDto,
      );

      expect(thumbnailRepository.create).toHaveBeenCalledWith({
        ...createThumbnailDto,
        bucketId: 'fileBucketId',
        fileId: 123456,
        fileUuid: fileUuid,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(existingThumbnail);
    });
  });

  describe('deleteThumbnailByFileUuid', () => {
    it('When the thumbnail exists, it should delete the thumbnail and call the network service', async () => {
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      jest.spyOn(networkService, 'deleteFile').mockResolvedValue(undefined);
      jest.spyOn(thumbnailRepository, 'deleteBy').mockResolvedValue(undefined);

      await thumbnailUseCases.deleteThumbnailByFileUuid(userMocked, fileUuid);

      expect(networkService.deleteFile).toHaveBeenCalledWith(
        userMocked,
        existingThumbnail.bucket_id,
        existingThumbnail.bucket_file,
      );
      expect(thumbnailRepository.deleteBy).toHaveBeenCalledWith({
        fileUuid: fileUuid,
      });
    });

    it('When an error occurs while deleting the file in the network service, it should propagate the error', async () => {
      jest
        .spyOn(thumbnailRepository, 'findByFileUuid')
        .mockResolvedValue(existingThumbnail);
      jest
        .spyOn(networkService, 'deleteFile')
        .mockRejectedValue(new Error('Network error'));

      await expect(
        thumbnailUseCases.deleteThumbnailByFileUuid(userMocked, fileUuid),
      ).rejects.toThrow('Network error');
    });

    it('When the thumbnail is not found then should return without throw an error', async () => {
      jest.spyOn(thumbnailRepository, 'findByFileUuid').mockResolvedValue(null);

      await expect(
        thumbnailUseCases.deleteThumbnailByFileUuid(userMocked, fileUuid),
      ).resolves.not.toThrow();
    });
  });
});
