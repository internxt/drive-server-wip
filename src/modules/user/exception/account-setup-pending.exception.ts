import { ForbiddenException } from '@nestjs/common';

export class AccountSetupPendingException extends ForbiddenException {
  constructor() {
    super({
      message: 'The account setup is pending, check your email to complete it',
      code: 'AccountSetupPending',
    });
  }
}
