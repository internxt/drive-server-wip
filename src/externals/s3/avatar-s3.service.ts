import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

interface IS3Singleton<T> {
  getInstance(): T;
}
@Injectable()
export class AvatarS3Service implements IS3Singleton<AWS.S3> {
  private static instance: AWS.S3;

  getInstance(): AWS.S3 {
    if (AvatarS3Service.instance) {
      return AvatarS3Service.instance;
    }
    AvatarS3Service.instance = new AWS.S3({
      endpoint: process.env.AVATAR_ENDPOINT,
      region: process.env.AVATAR_REGION,
      credentials: {
        accessKeyId: process.env.AVATAR_ACCESS_KEY,
        secretAccessKey: process.env.AVATAR_SECRET,
      },
      s3ForcePathStyle: process.env.AVATAR_FORCE_PATH_STYLE === 'true',
    });

    return AvatarS3Service.instance;
  }
}
