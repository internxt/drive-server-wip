import { BaseHttpException } from '../../../common/base-http.exception';

export class UserException extends BaseHttpException {
  constructor(message: string, statusCode: number, code?: string) {
    super(`User -> ${message}`, statusCode, code);
  }
}
