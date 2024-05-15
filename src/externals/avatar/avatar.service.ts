import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  GetObjectCommand,
  ObjectCannedACL,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Express } from 'express';
import { User } from '../../modules/user/user.domain';
import { Workspace } from '../../modules/workspaces/domains/workspaces.domain';
import { v4 } from 'uuid';

@Injectable()
export class AvatarService {
  AvatarS3Instance(): S3Client {
    return new S3Client({
      endpoint: process.env.AVATAR_ENDPOINT,
      region: process.env.AVATAR_REGION,
      credentials: {
        accessKeyId: process.env.AVATAR_ACCESS_KEY,
        secretAccessKey: process.env.AVATAR_SECRET_KEY,
      },
      forcePathStyle: process.env.AVATAR_FORCE_PATH_STYLE === 'true',
    });
  }

  async getDownloadUrl(
    avatarKey: User['avatar'] | Workspace['avatar'],
  ): Promise<string> {
    const s3Client = this.AvatarS3Instance();
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.AVATAR_BUCKET,
        Key: avatarKey,
      }),
      {
        expiresIn: 24 * 3600,
      },
    );

    const endpointRewrite = process.env.AVATAR_ENDPOINT_REWRITE_FOR_SIGNED_URLS;
    if (endpointRewrite) {
      return url.replace(process.env.AVATAR_ENDPOINT, endpointRewrite);
    } else {
      return url;
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    const s3Client = this.AvatarS3Instance();
    const bucket = process.env.AVATAR_BUCKET;
    const keyObject = v4();

    const putObjectInput = {
      Bucket: bucket,
      Key: keyObject,
      Body: file.buffer,
      ACL: ObjectCannedACL.public_read,
      ContentType: file.mimetype,
    };

    const putObjectCommand = new PutObjectCommand(putObjectInput);
    await s3Client.send(putObjectCommand);
    return keyObject;
  }

  async deleteAvatar(avatarKey: User['avatar'] | Workspace['avatar']) {
    const s3Client = this.AvatarS3Instance();
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: process.env.AVATAR_BUCKET,
      Key: avatarKey,
    });
    await s3Client.send(deleteObjectCommand);
  }
}
