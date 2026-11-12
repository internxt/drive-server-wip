import { BadRequestException, HttpStatus } from '@nestjs/common';

export const EMPTY_FILES_LIMIT_REACHED = 'EMPTY_FILES_LIMIT_REACHED';

export class EmptyFilesLimitReachedException extends BadRequestException {
  constructor(message = 'You can not have more empty files') {
    super({
      message,
      error: 'Bad Request',
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: EMPTY_FILES_LIMIT_REACHED,
    });
  }
}
