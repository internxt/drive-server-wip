import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from './avatar.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { v4 } from 'uuid';
import configuration from '../../config/configuration';

describe('Avatar Service', () => {
  let service: AvatarService;
  let mockS3Client;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV}`],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        {
          provide: AvatarService,
          useFactory: async (configService: ConfigService) => {
            return new AvatarService(configService);
          },
          inject: [ConfigService],
        },
      ],
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
      const response = await service.getDownloadUrl(avatarKey);
      const url = new URL(response);
      expect(url).toBeInstanceOf(URL);
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

    // { // CreateMultipartUploadOutput
    //   AbortDate: new Date("TIMESTAMP"),
    //   AbortRuleId: "STRING_VALUE",
    //   Bucket: "STRING_VALUE",
    //   Key: "STRING_VALUE",
    //   UploadId: "STRING_VALUE",
    //   ServerSideEncryption: "AES256" || "aws:kms" || "aws:kms:dsse",
    //   SSECustomerAlgorithm: "STRING_VALUE",
    //   SSECustomerKeyMD5: "STRING_VALUE",
    //   SSEKMSKeyId: "STRING_VALUE",
    //   SSEKMSEncryptionContext: "STRING_VALUE",
    //   BucketKeyEnabled: true || false,
    //   RequestCharged: "requester",
    //   ChecksumAlgorithm: "CRC32" || "CRC32C" || "SHA1" || "SHA256",
    // };
    it('When the avatar upload is successful, it should return the uuid', async () => {
      const uploadId = 'this-is-the-upload-id';
      const eTag = 'this-is-an-etag';
      mockS3Client.on(CreateMultipartUploadCommand).resolves({
        UploadId: uploadId,
      });
      mockS3Client.on(UploadPartCommand).resolves({
        ETag: eTag,
      });

      await expect(service.uploadAvatarAsStream(file)).resolves.toStrictEqual(
        expect.any(String),
      );
      await expect(service.uploadAvatarAsStream(file)).resolves.toHaveLength(
        36,
      );
    });

    it('When the avatar loading fails, then the error is propagated', async () => {
      mockS3Client.on(PutObjectCommand).rejects();

      await expect(service.uploadAvatarAsStream(file)).rejects.toThrow();
    });
  });

  describe('Delete avatar', () => {
    it('When deleting the avatar is successful, it should delete the avatar file and return true', async () => {
      const avatarKey = 'cc925fa0-a145-58b8-8959-8b3796fd025f';

      mockS3Client
        .on(DeleteObjectCommand, {
          Bucket: 'avatars',
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

    it('When the avatar deletion fails, then the error is propagated', async () => {
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
