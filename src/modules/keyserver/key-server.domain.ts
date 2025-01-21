export enum UserKeysEncryptVersions {
  Ecc = 'ecc',
  Kyber = 'kyber',
}

export interface Keys {
  publicKey: string;
  privateKey: string;
  revocationKey?: string;
}

export interface KeyServerAttributes extends Keys {
  id: number;
  userId: number;
  encryptVersion: UserKeysEncryptVersions;
}

export class KeyServer implements KeyServerAttributes {
  id: number;
  userId: number;
  publicKey: string;
  privateKey: string;
  revocationKey?: string;
  encryptVersion: UserKeysEncryptVersions;

  constructor({
    id,
    userId,
    publicKey,
    privateKey,
    revocationKey,
    encryptVersion,
  }: KeyServerAttributes) {
    this.id = id;
    this.userId = userId;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.revocationKey = revocationKey;
    this.encryptVersion = encryptVersion;
  }

  static build(atributes: KeyServerAttributes): KeyServer {
    return new KeyServer(atributes);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      revocationKey: this.revocationKey,
      encryptVersion: this.encryptVersion,
    };
  }

  validate() {
    return KeyServer.validate(this.encryptVersion, this);
  }

  static validate(
    encryptVersion: UserKeysEncryptVersions,
    keyData: Partial<Keys>,
  ) {
    const requiredFields = {
      [UserKeysEncryptVersions.Kyber]: ['publicKey', 'privateKey'],
      [UserKeysEncryptVersions.Ecc]: [
        'publicKey',
        'privateKey',
        'revocationKey',
      ],
    };

    const required = requiredFields[encryptVersion];

    if (!required) {
      throw new Error(`Unsupported encryption version: ${encryptVersion}`);
    }

    for (const field of required) {
      if (!keyData[field]) {
        throw new Error(
          `${field} is required for encryption version ${encryptVersion}.`,
        );
      }
    }

    return true;
  }
}
