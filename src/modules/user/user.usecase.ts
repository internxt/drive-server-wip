import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '@internxt/inxt-js';
import { v4 } from 'uuid';

import { SequelizeUserRepository } from './user.repository';
import { UserAttributes } from './user.domain';
import { CryptoService } from '../../externals/crypto/crypto';
import { FolderUseCases } from '../folder/folder.usecase';
import { BridgeService } from 'src/externals/bridge/bridge.service';
import { InvitationAcceptedEvent } from 'src/externals/notifications/events/invitation-accepted.event';
import { NotificationService } from 'src/externals/notifications/notification.service';
import { Sign } from 'src/middlewares/passport';

class InvalidReferralCodeError extends Error {
  constructor() {
    super('The referral code used is not correct');

    Object.setPrototypeOf(this, InvalidReferralCodeError.prototype);
  }
}

class UserAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`User ${email || ''} is already registered`);

    Object.setPrototypeOf(this, UserAlreadyRegisteredError.prototype);
  }
}

@Injectable()
export class UserUseCases {
  constructor(
    private userRepository: SequelizeUserRepository,
    private folderUseCases: FolderUseCases,
    private configService: ConfigService,
    private cryptoService: CryptoService,
    private networkService: BridgeService,
    private notificationService: NotificationService,
  ) {}

  getUserByUsername(email: string) {
    return this.userRepository.findByUsername(email);
  }

  getWorkspaceMembersByBrigeUser(bridgeUser: string) {
    return this.userRepository.findAllBy({ bridgeUser });
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
