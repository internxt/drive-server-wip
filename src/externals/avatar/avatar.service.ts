import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  GetObjectCommand,
  ObjectCannedACL,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Express } from 'express';
import { User } from '../../modules/user/user.domain';
import { Workspace } from '../../modules/workspaces/domains/workspaces.domain';
import { v4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class AvatarService {
  private configService: ConfigService;

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

  async uploadAvatarAsBuffer(file: Express.Multer.File): Promise<string> {
    const s3Client = this.AvatarS3Instance();
    const bucket = this.configService.get('avatar.bucket');
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

  async uploadAvatarAsStream(file: Express.Multer.File): Promise<string> {
    const s3Client = this.AvatarS3Instance();
    const bucket = this.configService.get('avatar.bucket');
    const keyObject = v4();

    try {
      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null); // End of the stream

      const createMultipartUploadCommand = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: keyObject,
      });
      const { UploadId } = await s3Client.send(createMultipartUploadCommand);

      const parts = [];
      let partNumber = 0;

      for await (const chunks of stream) {
        partNumber++;
        const uploadPartCommand = new UploadPartCommand({
          Bucket: bucket,
          Key: keyObject,
          PartNumber: partNumber,
          UploadId,
          Body: String(chunks),
        });

        const { ETag } = await s3Client.send(uploadPartCommand);
        parts.push({ ETag, PartNumber: partNumber });
      }

      const completeMultipartUploadCommand = new CompleteMultipartUploadCommand(
        {
          Bucket: bucket,
          Key: keyObject,
          MultipartUpload: { Parts: parts },
          UploadId,
        },
      );

      await s3Client.send(completeMultipartUploadCommand);

      return keyObject;
    } catch (error) {
      throw error;
    }
  }
}
