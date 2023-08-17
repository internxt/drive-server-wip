import { v4 } from 'uuid';

import { Folder } from '../src/modules/folder/folder.domain';
import { User } from '../src/modules/user/user.domain';
import { PrivateSharingFolder } from '../src/modules/private-share-folder/private-sharing-folder.domain';

function newFolder(owner?: User): Folder {
  return Folder.build({
    id: Math.random(),
    uuid: v4(),
    name: 'folder',
    parentId: 0,
    userId: owner?.id ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    bucket: '',
    plainName: '',
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    deletedAt: undefined,
    removedAt: undefined,
  });
}

function newUser(): User {
  return User.build({
    id: Math.random() * 999999,
    userId: '',
    name: 'John',
    lastname: 'Doe',
    uuid: v4(),
    email: '',
    username: '',
    bridgeUser: '',
    password: '',
    mnemonic: '',
    referrer: v4(),
    referralCode: v4(),
    credit: 0,
    hKey: Buffer.from(''),
    rootFolderId: 0,
    errorLoginCount: 0,
    isEmailActivitySended: 0,
    lastResend: new Date(),
    syncDate: new Date(),
    welcomePack: false,
    registerCompleted: false,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    tempKey: '',
    avatar: '',
  });
}

function newPrivateSharingFolder(bindTo: {
  owner?: User;
  sharedWith?: User;
  folder?: Folder;
}) {
  return PrivateSharingFolder.build({
    id: v4(),
    folderId: bindTo.folder?.uuid ?? v4(),
    ownerId: bindTo.owner?.uuid ?? v4(),
    sharedWith: bindTo.sharedWith?.uuid ?? v4(),
    createdAt: new Date(),
    encryptionKey: '',
  });
}

export { newUser, newFolder, newPrivateSharingFolder };
