import { BadRequestException, HttpStatus } from '@nestjs/common';

export const FILE_NOT_REPLACEABLE = 'FILE_NOT_REPLACEABLE';

export class FileNotReplaceableException extends BadRequestException {
  constructor(message: string) {
    super({
      message,
      error: 'Bad Request',
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: FILE_NOT_REPLACEABLE,
    });
  }
}
