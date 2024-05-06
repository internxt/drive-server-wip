import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import Busboy from 'busboy';
import { Request } from 'express';
import Counter from './counter';
import MultipartUploadError from './multipart.error';

const drainStream = (stream: Readable) => {
  stream.on('readable', stream.read.bind(stream));
};

@Injectable()
export class MultipartStreamManager {
  processSingleUpload<T>(
    req: Request,
    fileStorage: {
      saveFile: (file: Readable) => Promise<T>;
      removeFile?: (args: T) => Promise<void>;
    },
    fieldnameToProcess: string,
    options?: {
      limits?: {
        fileSize?: number;
      };
    },
  ) {
    const pendingWrites = new Counter();
    let uploadedFile: T | null = null;
    let isDone = false;
    let readFinished = false;
    let errorOccured = false;
    let isFileProcessed = false;

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: options?.limits?.fileSize,
      },
    });

    return new Promise<T | null | MultipartUploadError>((resolve, reject) => {
      function done(err?: MultipartUploadError) {
        if (isDone) return;
        isDone = true;

        req.unpipe(busboy);
        drainStream(req);
        busboy.removeAllListeners();

        resolve(err ?? uploadedFile);
      }

      function indicateDone() {
        if (readFinished && pendingWrites.isZero() && !errorOccured) done();
      }

      function abortWithError(uploadError) {
        if (errorOccured) return;
        errorOccured = true;

        pendingWrites.onceZero(async () => {
          if (fileStorage?.removeFile) {
            await fileStorage.removeFile(uploadedFile);
          }
          done(uploadError);
        });
      }

      function abortWithCode(code, optionalField) {
        abortWithError(new MultipartUploadError(code, optionalField));
      }

      busboy.on('file', async (fieldname, fileStream, { filename }) => {
        const discardRemainingFiles = isFileProcessed;
        if (
          fieldname !== fieldnameToProcess ||
          !filename ||
          discardRemainingFiles
        ) {
          fileStream.resume();
          return;
        }

        let aborting = false;
        isFileProcessed = true;
        pendingWrites.increment();

        fileStream.on('error', function (err) {
          pendingWrites.decrement();
          abortWithError(err);
        });

        fileStream.on('limit', () => {
          console.error(
            `[FILE_STREAM]: File is bigger than expected ${filename}`,
          );
          aborting = true;
          abortWithCode('LIMIT_FILE_SIZE', fieldname);
        });

        if (!aborting) {
          try {
            const result = await fileStorage.saveFile(fileStream);
            uploadedFile = result;
            pendingWrites.decrement();
            indicateDone();
          } catch (error) {
            reject(error);
          }
        }
      });

      busboy.on('finish', function () {
        readFinished = true;
        indicateDone();
      });

      req.pipe(busboy);
    });
  }
}
