import { KeyServerAttributes } from '../keyserver/key-server.domain';
import { UserAttributes } from './user.attributes';

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
}
