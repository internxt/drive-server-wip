import { Injectable } from '@nestjs/common';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';

@Injectable()
export class GatewayUseCases {
  constructor(private readonly userUsecases: UserUseCases) {}

  async getUserCredentials(uuid: User['uuid']): Promise<{
    user: User;
    oldToken: string;
    newToken: string;
  }> {
    const user = await this.userUsecases.getUser(uuid);
    const tokens = await this.userUsecases.getAuthTokens(user);

    return {
      user,
      oldToken: tokens.token,
      newToken: tokens.newToken,
    };
  }
}
