import { v4 } from 'uuid';
import { Chance } from 'chance';

import { Folder } from '../src/modules/folder/folder.domain';
import { User } from '../src/modules/user/user.domain';
import { PrivateSharingFolder } from '../src/modules/private-share-folder/private-sharing-folder.domain';
import { Sharing, SharingRole } from '../src/modules/sharing/sharing.domain';
import { File, FileAttributes } from '../src/modules/file/file.domain';
import { Thumbnail } from '../src/modules/thumbnail/thumbnail.domain';

export const constants = {
  BUCKET_ID_LENGTH: 24,
};

const randomDataGenerator = new Chance();

export type FolderSettableAttributes = Pick<
  Folder,
  'deleted' | 'deletedAt' | 'removed' | 'removedAt'
>;

type NewFolderParams = {
  attributes?: Partial<FolderSettableAttributes>;
  owner?: User;
};

export const newFolder = (params?: NewFolderParams): Folder => {
  const randomCreatedAt = randomDataGenerator.date();

  const folder = Folder.build({
    id: randomDataGenerator.natural({ min: 1 }),
    uuid: v4(),
    name: randomDataGenerator.string({
      length: 20,
    }),
    parentId: randomDataGenerator.natural({ min: 1 }),
    userId: randomDataGenerator.natural({ min: 1 }),
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
    bucket: randomDataGenerator.hash({
      length: constants.BUCKET_ID_LENGTH,
    }),
    plainName: randomDataGenerator.string({
      length: 20,
    }),
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    deletedAt: undefined,
    removedAt: undefined,
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      folder[key] = params.attributes[key];
    });

  params?.owner && (folder.userId = params.owner.id);

  return folder;
};

export const newUser = (): User => {
  const randomEmail = randomDataGenerator.email();

  return User.build({
    id: randomDataGenerator.natural(),
    userId: '',
    name: 'John',
    lastname: 'Doe',
    uuid: v4(),
    email: randomEmail,
    username: randomEmail,
    bridgeUser: randomEmail,
    password: '',
    mnemonic: '',
    referrer: v4(),
    referralCode: v4(),
    credit: 0,
    hKey: Buffer.from(''),
    rootFolderId: randomDataGenerator.natural(),
    errorLoginCount: 0,
    isEmailActivitySended: 0,
    lastResend: randomDataGenerator.date(),
    syncDate: randomDataGenerator.date(),
    welcomePack: false,
    registerCompleted: false,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    tempKey: '',
    avatar: v4(),
  });
};

export const newPrivateSharingFolder = (bindTo?: {
  owner?: User;
  sharedWith?: User;
  folder?: Folder;
}): PrivateSharingFolder => {
  return PrivateSharingFolder.build({
    id: v4(),
    folderId: bindTo?.folder?.uuid || v4(),
    ownerId: bindTo?.owner?.uuid || v4(),
    sharedWith: bindTo?.sharedWith?.uuid || v4(),
    createdAt: randomDataGenerator.date(),
    encryptionKey: randomDataGenerator.string({
      length: 32,
    }),
  });
};

export const newSharing = (bindTo?: {
  owner?: User;
  sharedWith?: User;
  item?: File | Folder;
}): Sharing => {
  return Sharing.build({
    id: v4(),
    itemId: bindTo?.item?.uuid || v4(),
    itemType: (bindTo?.item instanceof File ? 'file' : 'folder') || 'folder',
    ownerId: bindTo?.owner?.uuid || v4(),
    sharedWith: bindTo?.sharedWith?.uuid || v4(),
    createdAt: randomDataGenerator.date(),
    updatedAt: randomDataGenerator.date(),
    encryptionAlgorithm: 'test',
    encryptionKey: randomDataGenerator.string({
      length: 32,
    }),
  });
};

export const newSharingRole = (bindTo?: {
  sharingId?: string;
  roleId?: string;
}): SharingRole => {
  return SharingRole.build({
    id: v4(),
    sharingId: bindTo?.sharingId,
    roleId: bindTo?.roleId,
    createdAt: randomDataGenerator.date(),
    updatedAt: randomDataGenerator.date(),
  });
};

export const newThumbnail = (file: FileAttributes): Thumbnail => {
  return Thumbnail.build({
    id: randomDataGenerator.integer({ min: 1 }),
    fileId: file.id,
    type: 'png',
    size: randomDataGenerator.integer({ min: 100, max: 300 }),
    bucketId: file.bucket,
    bucketFile: file.fileId,
    encryptVersion: 'aes-3',
    createdAt: randomDataGenerator.date(),
    updatedAt: undefined,
    maxWidth: 300,
    maxHeight: 300,
  });
}
