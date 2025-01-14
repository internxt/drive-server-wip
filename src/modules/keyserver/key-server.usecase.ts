import { Injectable } from '@nestjs/common';
import { UserAttributes } from '../user/user.attributes';
import {
  Keys,
  KeyServer,
  KeyServerAttributes,
  UserKeysEncryptVersions,
} from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';

@Injectable()
export class KeyServerUseCases {
  constructor(private repository: SequelizeKeyServerRepository) {}

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
        encryptVersion: UserKeysEncryptVersions.Ecc,
      });

    return { publicKey, privateKey, revocationKey };
  }

  async findOrCreateKeysForUser(
    userId: UserAttributes['id'],
    keys: Partial<Omit<KeyServerAttributes, 'id' | 'userId'>>,
  ): Promise<KeyServer> {
    if (
      !keys.privateKey ||
      !keys.publicKey ||
      !keys.revocationKey ||
      !keys.encryptVersion
    ) {
      return;
    }

    const [createdKeys] = await this.repository.findUserKeysOrCreate(userId, {
      userId,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      revocationKey: keys.revocationKey,
      encryptVersion: keys.encryptVersion,
    });

    return createdKeys;
  }

  async updateByUserAndEncryptVersion(
    userId: UserAttributes['id'],
    encryptVersion: KeyServerAttributes['encryptVersion'],
    data: Partial<Omit<KeyServerAttributes, 'id'>>,
  ): Promise<void> {
    await this.repository.updateByUserAndEncryptVersion(
      userId,
      encryptVersion,
      data,
    );
  }

  async getPublicKeys(userId: UserAttributes['id']) {
    const userKeys = await this.repository.findUserKeys(userId);

    const publicKey = this.findKeyByEncryptionMethod(
      userKeys,
      UserKeysEncryptVersions.Ecc,
    );

    const kyberPublicKey = this.findKeyByEncryptionMethod(
      userKeys,
      UserKeysEncryptVersions.Kyber,
    );

    return {
      publicKey: publicKey?.publicKey || null,
      keys: {
        kyber: {
          publicKey: kyberPublicKey?.publicKey || null,
        },
        ecc: {
          publicKey: publicKey?.publicKey || null,
        },
      },
    };
  }

  async deleteByUserId(userId: UserAttributes['id']): Promise<void> {
    await this.repository.deleteByUserId(userId);
  }

  async findUserKeys(
    userId: UserAttributes['id'],
  ): Promise<{ kyberKeys: KeyServerAttributes; eccKeys: KeyServerAttributes }> {
    const keys = await this.repository.findUserKeys(userId);

    const kyberKeys = keys.find((key) => key.encryptVersion === 'kyber');
    const eccKeys = keys.find((key) => key.encryptVersion === 'ecc');

    return { kyberKeys, eccKeys };
  }

  private findKeyByEncryptionMethod = (
    userKeys: KeyServer[],
    version: UserKeysEncryptVersions,
  ): KeyServer | null =>
    userKeys.find((key) => key.encryptVersion === version) || null;
}
