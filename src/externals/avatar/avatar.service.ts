import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  GetObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { type User } from '../../modules/user/user.domain';
import { type Workspace } from '../../modules/workspaces/domains/workspaces.domain';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AvatarService {
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  AvatarS3Instance(): S3Client {
    return new S3Client({
      endpoint: this.configService.get('avatar.endpoint'),
      region: this.configService.get('avatar.region'),
      credentials: {
        accessKeyId: this.configService.get('avatar.accessKey'),
        secretAccessKey: this.configService.get('avatar.secretKey'),
      },
      forcePathStyle:
        this.configService.get('avatar.forcePathStyle') === 'true',
    });
  }

  async getDownloadUrl(
    avatarKey: User['avatar'] | Workspace['avatar'],
  ): Promise<string> {
    const s3Client = this.AvatarS3Instance();
    const bucket = this.configService.get('avatar.bucket');
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: avatarKey,
      }),
      {
        expiresIn: 24 * 3600,
      },
    );

    const endpointRewrite = this.configService.get(
      'avatar.endpointForSignedUrls',
    );
    if (endpointRewrite) {
      const avatarEndpoint = this.configService.get('avatar.endpoint');
      return url.replace(avatarEndpoint, endpointRewrite);
    } else {
      return url;
    }
  }

  async deleteAvatar(
    avatarKey: User['avatar'] | Workspace['avatar'],
  ): Promise<boolean> {
    const s3Client = this.AvatarS3Instance();
    const bucket = this.configService.get('avatar.bucket');
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: avatarKey,
    });
    await s3Client.send(deleteObjectCommand);
    return true;
  }
}
