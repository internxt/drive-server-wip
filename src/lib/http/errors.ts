import { BadRequestException } from '@nestjs/common';

export class BadRequestParamOutOfRangeException extends BadRequestException {
  constructor(paramName: string, lowerBound: number, upperBound: number) {
    super(`${paramName} should be between ${lowerBound} and ${upperBound}`);

    Object.setPrototypeOf(this, BadRequestParamOutOfRangeException.prototype);
  }
}
