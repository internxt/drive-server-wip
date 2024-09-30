import { SharingException } from './sharing.exception';

export class SharingNotFoundException extends SharingException {
  constructor(
    message = 'Sharing not found',
    statusCode = 404,
    code = 'SHARING_NOT_FOUND',
  ) {
    super(message, statusCode, code);
  }
}
