export interface Keys {
  publicKey: string;
  privateKey: string;
  revocationKey: string;
}

export interface KeyServerAttributes extends Keys {
  id: number;
  userId: number;
  encryptVersion: 'ecc' | 'kyber';
}

export class KeyServer implements KeyServerAttributes {
  id: number;
  userId: number;
  publicKey: string;
  privateKey: string;
  revocationKey: string;
  encryptVersion: 'ecc' | 'kyber';

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
}
