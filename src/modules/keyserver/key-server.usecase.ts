import { Injectable } from '@nestjs/common';
import { UserAttributes } from '../user/user.attributes';
import {
  KeyServer,
  KeyServerAttributes,
  UserKeysEncryptVersions,
} from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';

export class InvalidKeyServerException extends Error {
  constructor(public validationMessage: string) {
    super(validationMessage);
    Object.setPrototypeOf(this, InvalidKeyServerException.prototype);
  }
}

type PartialKeys = Partial<Omit<KeyServerAttributes, 'id' | 'userId'>>;

@Injectable()
export class KeyServerUseCases {
  constructor(private repository: SequelizeKeyServerRepository) {}

  async addKeysToUser(
    userId: UserAttributes['id'],
    keys: {
      kyber?: Omit<PartialKeys, 'encryptVersion'>;
      ecc?: Omit<PartialKeys, 'encryptVersion'>;
    },
  ): Promise<{ kyber: KeyServer | null; ecc: KeyServer | null }> {
    const processKey = async (
      encryptVersion: UserKeysEncryptVersions,
      keyData?: Omit<PartialKeys, 'encryptVersion'>,
    ): Promise<KeyServer | null> => {
      if (!keyData) return null;

      try {
        return await this.findOrCreateKeysForUser(userId, {
          publicKey: keyData.publicKey,
          privateKey: keyData.privateKey,
          revocationKey: keyData.revocationKey,
          encryptVersion,
        });
      } catch {
        return null;
      }
    };

    const [kyberKey, eccKey] = await Promise.all([
      processKey(UserKeysEncryptVersions.Kyber, keys.kyber),
      processKey(UserKeysEncryptVersions.Ecc, keys.ecc),
    ]);

    return { kyber: kyberKey, ecc: eccKey };
  }

  async findOrCreateKeysForUser(
    userId: UserAttributes['id'],
    keys: PartialKeys,
  ): Promise<KeyServer> {
    try {
      KeyServer.validate(keys.encryptVersion, keys);
    } catch (error) {
      throw new InvalidKeyServerException(error.message);
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

  async getPublicKeys(userId: UserAttributes['id']): Promise<{
    kyber: {
      publicKey: string | null;
    };
    ecc: {
      publicKey: string | null;
    };
  }> {
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
      kyber: {
        publicKey: kyberPublicKey?.publicKey || null,
      },
      ecc: {
        publicKey: publicKey?.publicKey || null,
      },
    };
  }

  async deleteByUserId(userId: UserAttributes['id']): Promise<void> {
    await this.repository.deleteByUserId(userId);
  }

  async findUserKeys(
    userId: UserAttributes['id'],
  ): Promise<{ kyber: KeyServer | null; ecc: KeyServer | null }> {
    const keys = await this.repository.findUserKeys(userId);

    const kyber = keys.find((key) => key.encryptVersion === 'kyber');
    const ecc = keys.find((key) => key.encryptVersion === 'ecc');

    return { kyber, ecc };
  }

  private findKeyByEncryptionMethod(
    userKeys: KeyServer[],
    version: UserKeysEncryptVersions,
  ): KeyServer | null {
    return userKeys.find((key) => key.encryptVersion === version) || null;
  }
}
