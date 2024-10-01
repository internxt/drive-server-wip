import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from '../../../common/base-http.exception';

export class CalculateFolderSizeTimeoutException extends BaseHttpException {
  constructor(
    message = 'Calculate folder size timeout',
    code = 'CALCULATE_FOLDER_SIZE_TIMEOUT',
    statusCode = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(message, statusCode, code);
  }
}
