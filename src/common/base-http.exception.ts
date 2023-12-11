import { HttpStatus } from '@nestjs/common';

export class BaseHttpException extends Error {
  private readonly _statusCode: number;
  private readonly _code: string;

  constructor(
    message: string,
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
  ) {
    super(message);
    this.message = message;
    this._statusCode = statusCode;
    this._code = code;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  get code(): string {
    return this._code;
  }
}
