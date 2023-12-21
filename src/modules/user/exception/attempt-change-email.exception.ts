import { BaseHttpException } from '../../../common/base-http.exception';

export class AttemptChangeEmailException extends BaseHttpException {
  constructor(message: string, statusCode: number, code?: string) {
    super(`AttemptChangeEmail -> ${message}`, statusCode, code);
  }
}
