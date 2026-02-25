import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { type UserAttributes } from '../user/user.attributes';
import {
  KeyServer,
  type KeyServerAttributes,
  UserKeysEncryptVersions,
} from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';
import { type EccKeysDto, type KyberKeysDto } from './dto/keys.dto';

export class InvalidKeyServerException extends BadRequestException {
  constructor(public validationMessage: string) {
    super(validationMessage);
    Object.setPrototypeOf(this, InvalidKeyServerException.prototype);
  }
}

type PartialKeys = Partial<Omit<KeyServerAttributes, 'id' | 'userId'>>;

@Injectable()
export class KeyServerUseCases {
  constructor(private readonly repository: SequelizeKeyServerRepository) {}

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
      } catch (error) {
        Logger.error(
          `[KEYS/ADD_KEYS_TO_USER]: Error adding ${encryptVersion} key to user ${userId}, error: ${JSON.stringify(
            error,
          )}`,
        );
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
    kyber: string | null;
    ecc: string | null;
  }> {
    const userKeys = await this.repository.findUserKeys(userId);

    const eccKeys = this.findKeyByEncryptionMethod(
      userKeys,
      UserKeysEncryptVersions.Ecc,
    );

    const kyberKeys = this.findKeyByEncryptionMethod(
      userKeys,
      UserKeysEncryptVersions.Kyber,
    );

    return {
      kyber: kyberKeys?.publicKey || null,
      ecc: eccKeys?.publicKey || null,
    };
  }

  async findUserKeys(
    userId: UserAttributes['id'],
  ): Promise<{ kyber: KeyServer | null; ecc: KeyServer | null }> {
    const keys = await this.repository.findUserKeys(userId);

    const kyber = keys.find(
      (key) => key.encryptVersion === UserKeysEncryptVersions.Kyber,
    );
    const ecc = keys.find(
      (key) => key.encryptVersion === UserKeysEncryptVersions.Ecc,
    );

    return { kyber, ecc };
  }

  private findKeyByEncryptionMethod(
    userKeys: KeyServer[],
    version: UserKeysEncryptVersions,
  ): KeyServer | null {
    return userKeys.find((key) => key.encryptVersion === version) || null;
  }

  parseKeysInput(
    keys: {
      kyber?: PartialKeys;
      ecc?: PartialKeys;
    },
    oldKeys?: {
      privateKey: string;
      publicKey: string;
      revocationKey: string;
    },
  ): {
    ecc: EccKeysDto;
    kyber: KyberKeysDto;
  } {
    const eccKeys =
      keys?.ecc || (oldKeys?.publicKey && oldKeys?.privateKey)
        ? {
            publicKey: keys?.ecc?.publicKey || oldKeys?.publicKey,
            privateKey: keys?.ecc?.privateKey || oldKeys?.privateKey,
            revocationKey: keys?.ecc?.revocationKey || oldKeys?.revocationKey,
          }
        : null;

    const kyberKeys =
      keys?.kyber?.publicKey && keys?.kyber?.privateKey
        ? {
            publicKey: keys.kyber.publicKey,
            privateKey: keys.kyber.privateKey,
          }
        : null;

    return { ecc: eccKeys, kyber: kyberKeys };
  }
}
