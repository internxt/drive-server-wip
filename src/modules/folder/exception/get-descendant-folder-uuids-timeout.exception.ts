import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from '../../../common/base-http.exception';

export class GetDescendantFolderUuidsTimeoutException extends BaseHttpException {
  constructor(
    message = 'Get descendant folder uuids timeout',
    code = 'GET_DESCENDANT_FOLDER_UUIDS_TIMEOUT',
    statusCode = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(message, statusCode, code);
  }
}
