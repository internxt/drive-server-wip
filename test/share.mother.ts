import { File } from './../src/modules/file/file.domain';
import { Share } from './../src/modules/share/share.domain';
import { User } from './../src/modules/user/user.domain';

const userOwnerMock = User.build({
  id: 1,
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
  syncDate: new Date('2022-09-22T08:06:02.436Z'),
  uuid: 'uuid',
  lastResend: new Date('2022-09-22T08:06:02.436Z'),
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

const mockFile = File.build({
  id: 1,
  fileId: 'fileId',
  name: 'File 1',
  type: 'png',
  size: null,
  bucket: 'bucket',
  folderId: 1,
  encryptVersion: '',
  deleted: false,
  deletedAt: undefined,
  userId: 1,
  modificationTime: new Date('2022-09-22T08:06:02.436Z'),
  createdAt: new Date('2022-09-22T08:06:02.436Z'),
  updatedAt: new Date('2022-09-22T08:06:02.436Z'),
});

export class ShareMother {
  static createWithPassword(hashedPassword: string): Share {
    return Share.build({
      id: 1,
      token: 'token',
      mnemonic: 'test',
      user: userOwnerMock,
      item: mockFile,
      encryptionKey: 'test',
      bucket: 'test',
      itemToken: 'token',
      isFolder: false,
      views: 0,
      timesValid: 10,
      active: true,
      createdAt: new Date('2022-09-22T08:06:02.436Z'),
      updatedAt: new Date('2022-09-22T08:06:02.436Z'),
      hashedPassword,
    });
  }
}
