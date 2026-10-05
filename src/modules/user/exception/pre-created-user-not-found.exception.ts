import { NotFoundException } from '@nestjs/common';

export class PreCreatedUserNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'Pre-created user not found',
      code: 'USER_NOT_FOUND',
    });
  }
}
