import { Injectable } from '@nestjs/common';
import { UserAttributes } from '../user/user.attributes';
import { Keys } from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';

@Injectable()
export class KeyServerUseCases {
  constructor(private repository: SequelizeKeyServerRepository) {}

  async addKeysToUser(
    userId: UserAttributes['id'],
    keys: Keys,
  ): Promise<Keys | null> {
    if (!keys.privateKey || !keys.publicKey || !keys.revocationKey) {
      return null;
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
