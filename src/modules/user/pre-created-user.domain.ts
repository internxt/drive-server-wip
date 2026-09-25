import { type UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { type PreCreatedUserAttributes } from './pre-created-users.attributes';

export class PreCreatedUser implements PreCreatedUserAttributes {
  id: number;
  uuid: string;
  email: string;
  username: string;
  password: string;
  mnemonic: string;
  hKey: Buffer | string;
  publicKey: string;
  privateKey: string;
  revocationKey: string;
  encryptVersion: UserKeysEncryptVersions;
  publicKyberKey?: string;
  privateKyberKey?: string;
  setupEmailSentAt?: Date | null;
  tierId?: string | null;
  constructor({
    id,
    email,
    username,
    password,
    mnemonic,
    hKey,
    uuid,
    publicKey,
    privateKey,
    revocationKey,
    encryptVersion,
    publicKyberKey,
    privateKyberKey,
    setupEmailSentAt,
    tierId,
  }: PreCreatedUserAttributes) {
    this.id = id;
    this.uuid = uuid;
    this.email = email;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.revocationKey = revocationKey;
    this.encryptVersion = encryptVersion;
    this.publicKyberKey = publicKyberKey;
    this.privateKyberKey = privateKyberKey;
    this.username = username;
    this.password = password;
    this.mnemonic = mnemonic;
    this.hKey = hKey;
    this.setupEmailSentAt = setupEmailSentAt ?? null;
    this.tierId = tierId ?? null;
  }

  static build(user: PreCreatedUserAttributes): PreCreatedUser {
    return new PreCreatedUser(user);
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      uuid: this.uuid,
      username: this.username,
    };
  }
}
