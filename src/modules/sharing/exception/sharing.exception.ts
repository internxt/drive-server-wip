import { BaseHttpException } from '../../../common/base-http.exception';

export class SharingException extends BaseHttpException {
  constructor(message: string, statusCode: number, code: string) {
    super(`Sharing -> ${message}`, statusCode, code);
  }
}
