import { Injectable } from '@nestjs/common';
import { SequelizeUserRepository } from './user.repository';

import { Environment } from '@internxt/inxt-js';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class UserUseCases {
  constructor(
    private userRepository: SequelizeUserRepository,
    private configService: ConfigService,
  ) {}

  async getUserByUsername(email: string) {
    return await this.userRepository.findByUsername(email);
  }

  async getWorkspaceMembersByBrigeUser(bridgeUser: string) {
    return await this.userRepository.findAllBy({ bridgeUser });
  }

  async getNetworkByUserId(id: number, mnemonic: string) {
    const user = await this.userRepository.findById(id);
    return new Environment({
      bridgePass: user.userId,
      bridgeUser: user.bridgeUser,
      encryptionKey: mnemonic,
      bridgeUrl: this.configService.get('apis.storage.url'),
    });
  }
}
