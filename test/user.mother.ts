import { User } from './../src/modules/user/user.domain';

const userMock = User.build({
  id: 2,
  userId: 'userId',
  name: 'User Owner',
  lastname: 'Lastname',
  email: 'fake@internxt.com',
  username: 'fake',
  bridgeUser: null,
  rootFolderId: 1,
  errorLoginCount: 0,
  isEmailActivitySended: 1,
  referralCode: null,
  referrer: null,
  syncDate: new Date(),
  uuid: 'uuid',
  lastResend: new Date(),
  credit: null,
  welcomePack: true,
  registerCompleted: true,
  backupsBucket: 'bucket',
  sharedWorkspace: true,
  avatar: 'avatar',
  password: '',
  mnemonic: '',
  hKey: undefined,
  secret_2FA: '',
  tempKey: '',
});

export class UserMother {
  static create(): User {
    return userMock;
  }
}
