import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import Busboy from 'busboy';
import { Request } from 'express';

enum errorMessages {
  LimitFileSize = 'File too large',
}

const drainStream = (stream: Readable) => {
  stream.on('readable', stream.read.bind(stream));
};

const cleanStream = (req: Request, busboy: Busboy.Busboy) => {
  req.unpipe(busboy);
  drainStream(req);
  busboy.removeAllListeners();
};

@Injectable()
export class MultipartStreamManager {
  processSingleUpload<T>(
    req: Request,
    fileStorage: {
      saveFile: (file: Readable) => Promise<T>;
      removeFile?: (key: string) => Promise<void>;
    },
    fieldnameToProcess: string,
    options?: {
      limits?: {
        fileSize?: number;
      };
    },
  ): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: options?.limits?.fileSize,
        },
      });

      let abortWithError: Error | null = null;
      let isFileProcessed = false;

      busboy.on('file', async (fieldname, file, { filename }) => {
        const discardRemainingFiles = isFileProcessed;

        if (
          fieldname !== fieldnameToProcess ||
          !filename ||
          discardRemainingFiles
        ) {
          file.resume();
          return;
        }

        isFileProcessed = true;

        file.on('limit', () => {
          console.error(
            `[FILE_STREAM]: File is bigger than expected ${filename}`,
          );
          abortWithError = new Error(errorMessages.LimitFileSize);
          file.resume();
        });

        if (!abortWithError) {
          try {
            const result = await fileStorage.saveFile(file);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      });

      busboy.on('finish', () => {
        cleanStream(req, busboy);

        if (abortWithError) {
          reject(abortWithError);
        }

        if (!isFileProcessed) {
          resolve(null);
        }
      });

      req.pipe(busboy);
    });
  }
}
