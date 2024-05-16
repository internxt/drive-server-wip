import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from './avatar.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

describe('Avatar Service', () => {
  let service: AvatarService;
  let mockS3Client;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [AvatarService],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
    mockS3Client = mockClient(S3Client);
  });

  describe('Get avatar download url', () => {
    it('When avatar key is null then it should throw an error', async () => {
      const avatarKey = null;
      await expect(service.getDownloadUrl(avatarKey)).rejects.toThrow();
    });
    it('When avatar key is not null then it should return an url', async () => {
      const avatarKey = 'cc925fa0-a145-58b8-8959-8b3796fd025f';
      await expect(service.getDownloadUrl(avatarKey)).resolves.toStrictEqual(
        expect.any(String),
      );
    });
  });

  describe('Upload avatar', () => {
    const file: Express.Multer.File = {
      stream: undefined,
      fieldname: undefined,
      originalname: undefined,
      encoding: undefined,
      mimetype: undefined,
      size: undefined,
      filename: undefined,
      destination: undefined,
      path: undefined,
      buffer: undefined,
    };

    it('When the PutObjectCommand has been created correctly it should delete the avatar file', async () => {
      mockS3Client.on(PutObjectCommand).resolves({
        $metadata: { httpStatusCode: 200 },
      });

      await expect(service.uploadAvatar(file)).resolves.toStrictEqual(
        expect.any(String),
      );
      await expect(service.uploadAvatar(file)).resolves.toHaveLength(36);
    });

    it('When the PutObjectCommand has been created wrong it should throw an error', async () => {
      mockS3Client.on(PutObjectCommand).rejects();

      await expect(service.uploadAvatar(file)).rejects.toThrow();
    });
  });

  describe('Delete avatar', () => {
    it('When the DeleteObjectCommand has been created correctly it should delete the avatar file', async () => {
      const avatarKey = 'cc925fa0-a145-58b8-8959-8b3796fd025f';

      mockS3Client
        .on(DeleteObjectCommand, {
          Bucket: process.env.AVATAR_BUCKET,
          Key: avatarKey,
        })
        .resolves({
          $metadata: { httpStatusCode: 204 },
          DeleteMarker: true,
          VersionId: '1',
          RequestCharged: 'requester',
        });

      await expect(service.deleteAvatar(avatarKey)).resolves.toBeTruthy();
    });

    it('When the DeleteObjectCommand has been created wrong it should throw an error', async () => {
      const avatarKey = 'cc925fa0-a145-58b8-8959-8b3796fd025f';

      mockS3Client
        .on(DeleteObjectCommand, {
          Key: avatarKey,
        })
        .rejects();

      await expect(service.deleteAvatar(avatarKey)).rejects.toThrow();
    });
  });
});
