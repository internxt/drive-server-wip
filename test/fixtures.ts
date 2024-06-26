import { v4 } from 'uuid';
import { Chance } from 'chance';
import { generateKeyPairSync } from 'crypto';
import { Folder } from '../src/modules/folder/folder.domain';
import { User } from '../src/modules/user/user.domain';
import {
  Sharing,
  SharingRole,
  SharingType,
} from '../src/modules/sharing/sharing.domain';
import { File, FileStatus } from '../src/modules/file/file.domain';
import { MailTypes } from '../src/modules/security/mail-limit/mailTypes';
import { MailLimit } from '../src/modules/security/mail-limit/mail-limit.domain';
import {
  LimitLabels,
  LimitTypes,
} from '../src/modules/feature-limit/limits.enum';
import { Limit } from '../src/modules/feature-limit/limit.domain';
import { UserNotificationTokens } from '../src/modules/user/user-notification-tokens.domain';
import { UserNotificationTokenAttributes } from '../src/modules/user/user-notification-tokens.attribute';

export const constants = {
  BUCKET_ID_LENGTH: 24,
};

const randomDataGenerator = new Chance();

export type FolderSettableAttributes = Pick<
  Folder,
  'deleted' | 'deletedAt' | 'removed' | 'removedAt'
>;

export type FilesSettableAttributes = Pick<
  File,
  'deleted' | 'deletedAt' | 'removed' | 'removedAt' | 'status'
>;

type NewFolderParams = {
  attributes?: Partial<Folder>;
  owner?: User;
};

type NewFilesParams = {
  attributes?: Partial<File>;
  owner?: User;
  folder?: Folder;
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
    parentUuid: v4(),
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

export const newFile = (params?: NewFilesParams): File => {
  const randomCreatedAt = randomDataGenerator.date();
  const randomCreationTime = randomDataGenerator.date();
  const folder = params?.folder || newFolder();

  const file = File.build({
    fileId: v4(),
    id: randomDataGenerator.natural({ min: 1 }),
    uuid: v4(),
    name: randomDataGenerator.string({
      length: 20,
    }),
    folderId: folder.id,
    folderUuid: folder.uuid,
    folder,
    userId: randomDataGenerator.natural({ min: 1 }),
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
    status: FileStatus.EXISTS,
    bucket: randomDataGenerator.hash({
      length: constants.BUCKET_ID_LENGTH,
    }),
    plainName: randomDataGenerator.string({
      length: 20,
    }),
    type: randomDataGenerator.string(),
    size: BigInt(randomDataGenerator.natural({ min: 1 })),
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    deletedAt: undefined,
    removedAt: undefined,
    creationTime: randomCreationTime,
    modificationTime: new Date(
      randomDataGenerator.date({
        min: randomCreationTime,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      file[key] = params.attributes[key];
    });

  params?.owner && (file.userId = params.owner.id);

  return file;
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
    avatar: v4(),
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
  });
};

export const publicUser = (): User => {
  const user = newUser();
  user.uuid = '00000000-0000-0000-0000-000000000000';
  user.name = 'Internxt';
  user.lastname = 'Internxt';
  user.email = 'Internxt@internxt.com';
  user.username = 'Internxt@internxt.com';
  user.bridgeUser = 'Internxt@internxt.com';
  return user;
};

export const newSharing = (bindTo?: {
  owner?: User;
  sharedWith?: User;
  item?: File | Folder;
  sharingType?: SharingType;
  encryptedPassword?: string;
}): Sharing => {
  return Sharing.build({
    type: bindTo.sharingType ? bindTo.sharingType : SharingType.Private,
    id: v4(),
    itemId: bindTo?.item?.uuid || v4(),
    itemType: (bindTo?.item instanceof File ? 'file' : 'folder') || 'folder',
    ownerId: bindTo?.owner?.uuid || v4(),
    sharedWith: bindTo?.sharedWith?.uuid || v4(),
    encryptedPassword: bindTo.encryptedPassword || null,
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

export const newMailLimit = (bindTo?: {
  userId?: number;
  mailType?: MailTypes;
  attemptsCount?: number;
  attemptsLimit?: number;
  lastMailSent?: Date;
}): MailLimit => {
  return MailLimit.build({
    id: randomDataGenerator.natural({ min: 1 }),
    userId: bindTo?.userId ?? randomDataGenerator.natural({ min: 1 }),
    mailType: bindTo?.mailType ?? MailTypes.UnblockAccount,
    attemptsCount: bindTo?.attemptsCount ?? 0,
    attemptsLimit: bindTo?.attemptsLimit ?? 5,
    lastMailSent: bindTo?.lastMailSent ?? new Date(),
  });
};

export const newFeatureLimit = (bindTo?: {
  id?: string;
  type: LimitTypes;
  label?: LimitLabels;
  value: string;
}): Limit => {
  return Limit.build({
    id: bindTo?.id ?? v4(),
    type: bindTo?.type ?? LimitTypes.Counter,
    value: bindTo?.value ?? '2',
    label: bindTo?.label ?? ('' as LimitLabels),
  });
};

export function generateBase64PrivateKeyStub(): string {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
  });
  const stringPrivateKey = privateKey.export({
    format: 'pem',
    type: 'pkcs1',
  }) as string;
  const base64privateKey = Buffer.from(stringPrivateKey).toString('base64');
  return base64privateKey;
}

export const newNotificationToken = (
  params: { attributes: Partial<UserNotificationTokenAttributes> } = null,
): UserNotificationTokens => {
  const token = UserNotificationTokens.build({
    id: v4(),
    userId: v4(),
    token: v4(),
    type: 'macos',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      token[key] = params.attributes[key];
    });
  return token;
};
