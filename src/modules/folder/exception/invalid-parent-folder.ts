import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from '../../../common/base-http.exception';

export class InvalidParentFolderException extends BaseHttpException {
  constructor(
    message = 'Invalid parent folder!',
    statusCode = HttpStatus.BAD_REQUEST,
  ) {
    super(message, statusCode);
  }
}
