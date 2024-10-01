import { HttpStatus } from '@nestjs/common';

export class BaseHttpException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly code?: string,
  ) {
    super(message);
  }
}
