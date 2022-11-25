import { Inject, Injectable } from '@nestjs/common';
import { UserAttributes } from '../user/user.domain';
import { Keys } from './key-server.domain';
import { KeyServerRepository } from './key-server.repository';

@Injectable()
export class KeyServerUseCases {
  constructor(
    @Inject('KEY_SERVER_REPOSITORY')
    private readonly repository: KeyServerRepository,
  ) {}

  async addKeysToUser(userId: UserAttributes['id'], keys: Keys): Promise<Keys> {
    if (!keys.publicKey) {
      throw new Error('Cannot add key to user. Missing Public Key');
    }
    if (!keys.privateKey) {
      throw new Error('Cannot add key to user. Missing Private Key');
    }
    if (!keys.revocationKey) {
      throw new Error('Cannot add key to user. Missing Revocation Key');
    }

    const [{ publicKey, privateKey, revocationKey }] =
      await this.repository.findUserKeysOrCreate(userId, {
        userId,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        revocationKey: keys.revocationKey,
        encryptVersion: null,
      });

    return { publicKey, privateKey, revocationKey };
  }
}
