import { Inject, Injectable } from '@nestjs/common';
import { UserAttributes } from '../user/user.attributes';
import { Keys } from './key-server.domain';
import { KeyServerRepository } from './key-server.repository';

@Injectable()
export class KeyServerUseCases {
  constructor(
    @Inject('KEY_SERVER_REPOSITORY')
    private readonly repository: KeyServerRepository,
  ) {}

  async addKeysToUser(userId: UserAttributes['id'], keys: Keys): Promise<Keys> {
    if (!keys.privateKey || !keys.publicKey || !keys.revocationKey) {
      return;
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

  async getPublicKey(userId: UserAttributes['id']): Promise<string> {
    const publicKey = await this.repository.findPublicKey(userId);

    return publicKey;
  }
}
