import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';

import { User } from '../../modules/user/user.domain';

@Injectable()
export class AvatarService {
  async getDownloadUrl(avatar: User['avatar']): Promise<string> {
    const s3 = new S3({
      endpoint: process.env.AVATAR_ENDPOINT,
      region: process.env.AVATAR_REGION,
      credentials: {
        accessKeyId: process.env.AVATAR_ACCESS_KEY,
        secretAccessKey: process.env.AVATAR_SECRET_KEY,
      },
      forcePathStyle: process.env.AVATAR_FORCE_PATH_STYLE === 'true',
    });

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AVATAR_BUCKET,
        Key: avatar,
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
}
