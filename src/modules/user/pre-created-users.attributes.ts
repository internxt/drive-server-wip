import { type KeyServerAttributes } from '../keyserver/key-server.domain';
import { type UserAttributes } from './user.attributes';

export enum PreCreatedUserStatus {
  AwaitingPayment = 'awaiting_payment',
  PendingSetup = 'pending_setup',
  Cancelled = 'cancelled',
}

export interface PreCreatedUserAttributes {
  id: UserAttributes['id'];
  email: UserAttributes['email'];
  username: UserAttributes['username'];
  password: UserAttributes['password'];
  mnemonic: UserAttributes['mnemonic'];
  hKey: UserAttributes['hKey'];
  uuid: UserAttributes['uuid'];
  publicKey: KeyServerAttributes['publicKey'];
  privateKey: KeyServerAttributes['privateKey'];
  revocationKey: KeyServerAttributes['revocationKey'];
  encryptVersion: KeyServerAttributes['encryptVersion'];
  publicKyberKey?: KeyServerAttributes['publicKey'];
  privateKyberKey?: KeyServerAttributes['privateKey'];
  setupEmailSentAt?: Date | null;
  tierId?: string | null;
  status?: PreCreatedUserStatus | null;
}
