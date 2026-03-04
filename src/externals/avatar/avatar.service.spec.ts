import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AvatarService } from './avatar.service';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import configuration from '../../config/configuration';
import { v4 } from 'uuid';
import * as s3RequestPresigner from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/s3-request-presigner');

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
      jest
        .spyOn(s3RequestPresigner, 'getSignedUrl')
        .mockRejectedValueOnce(new Error());
      await expect(service.getDownloadUrl(avatarKey)).rejects.toThrow();
    });
    it('When avatar key is not null then it should return an url', async () => {
      const avatarKey = v4();
      const expectedUrl = `https://avatar.network.com/${avatarKey}`;
      jest
        .spyOn(s3RequestPresigner, 'getSignedUrl')
        .mockResolvedValueOnce(expectedUrl);
      const response = await service.getDownloadUrl(avatarKey);
      expect(response).toBe(expectedUrl);
    });
  });

  describe('Delete avatar', () => {
    it('When deleting the avatar is successful, it should delete the avatar file and return true', async () => {
      const avatarKey = v4();
      await expect(service.deleteAvatar(avatarKey)).resolves.toBeTruthy();
    });

    it('When the avatar deletion fails, then the error is propagated', async () => {
      const avatarKey = v4();
      mockS3Client.on(DeleteObjectCommand).rejects();
      await expect(service.deleteAvatar(avatarKey)).rejects.toThrow();
    });
  });
});
