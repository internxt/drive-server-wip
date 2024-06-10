import { S3Client, ObjectCannedACL } from '@aws-sdk/client-s3';
import { v4 } from 'uuid';
import multerS3 from 'multer-s3';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import configuration from '../../config/configuration';
import { BadRequestException } from '@nestjs/common';

const { avatar: avatarConfig } = configuration();

export const avatarStorageS3Config: MulterOptions = {
  storage: multerS3({
    s3: new S3Client({
      endpoint: avatarConfig.endpoint,
      region: avatarConfig.region,
      credentials: {
        accessKeyId: avatarConfig.accessKey,
        secretAccessKey: avatarConfig.secretKey,
      },
      forcePathStyle: avatarConfig.forcePathStyle === 'true',
    }),
    bucket: avatarConfig.bucket,
    acl: ObjectCannedACL.public_read,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const filenameKeyS3 = v4();
      req.filenameKeyS3 = filenameKeyS3;
      cb(null, filenameKeyS3);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only image file are allowed'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 1,
    files: 1,
  },
};
