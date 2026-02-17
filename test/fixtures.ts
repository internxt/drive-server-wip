import { v4 } from 'uuid';
import { Chance } from 'chance';
import { Folder } from '../src/modules/folder/folder.domain';
import { User } from '../src/modules/user/user.domain';
import {
  Permission,
  Role,
  Sharing,
  SharingActionName,
  SharingRole,
  SharingType,
  SharingInvite,
} from '../src/modules/sharing/sharing.domain';
import { File, FileStatus } from '../src/modules/file/file.domain';
import { MailTypes } from '../src/modules/security/mail-limit/mailTypes';
import { MailLimit } from '../src/modules/security/mail-limit/mail-limit.domain';
import {
  LimitLabels,
  LimitTypes,
} from '../src/modules/feature-limit/limits.enum';
import { Limit } from '../src/modules/feature-limit/domain/limit.domain';
import { Tier } from '../src/modules/feature-limit/domain/tier.domain';
import { Workspace } from '../src/modules/workspaces/domains/workspaces.domain';
import { WorkspaceTeam } from '../src/modules/workspaces/domains/workspace-team.domain';
import { WorkspaceUser } from '../src/modules/workspaces/domains/workspace-user.domain';
import { WorkspaceInvite } from '../src/modules/workspaces/domains/workspace-invite.domain';
import { WorkspaceTeamUser } from '../src/modules/workspaces/domains/workspace-team-user.domain';
import {
  WorkspaceItemContext,
  WorkspaceItemType,
  WorkspaceItemUserAttributes,
} from '../src/modules/workspaces/attributes/workspace-items-users.attributes';
import { UserAttributes } from '../src/modules/user/user.attributes';
import { WorkspaceItemUser } from '../src/modules/workspaces/domains/workspace-item-user.domain';
import { PreCreatedUser } from '../src/modules/user/pre-created-user.domain';
import { UserNotificationTokens } from '../src/modules/user/user-notification-tokens.domain';
import { UserNotificationTokenAttributes } from '../src/modules/user/user-notification-tokens.attribute';
import {
  KeyServer,
  KeyServerAttributes,
  UserKeysEncryptVersions,
} from '../src/modules/keyserver/key-server.domain';
import { DeviceAttributes } from '../src/modules/backups/models/device.attributes';
import { Device, DevicePlatform } from '../src/modules/backups/device.domain';
import { Usage, UsageType } from '../src/modules/usage/usage.domain';
import { Notification } from '../src/modules/notifications/domain/notification.domain';
import { UserNotificationStatus } from '../src/modules/notifications/domain/user-notification-status.domain';
import { AuditLog } from '../src/common/audit-logs/audit-logs.domain';
import {
  AuditAction,
  AuditEntityType,
  AuditLogAttributes,
  AuditPerformerType,
} from '../src/common/audit-logs/audit-logs.attributes';
import { Trash } from '../src/modules/trash/trash.domain';
import { TrashItemType } from '../src/modules/trash/trash.attributes';
import {
  FileVersion,
  FileVersionAttributes,
  FileVersionStatus,
} from '../src/modules/file/file-version.domain';

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
    id: randomDataGenerator.natural({ min: 1, max: 99999 }),
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
    creationTime: randomDataGenerator.date(),
    modificationTime: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      folder[key] = params.attributes[key];
    });

  params?.owner && (folder.userId = params.owner.id);
  folder.status = folder.getFolderStatus();

  return folder;
};

export const newFile = (params?: NewFilesParams): File => {
  const randomCreatedAt = randomDataGenerator.date();
  const randomCreationTime = randomDataGenerator.date();
  const folder = params?.folder || newFolder();

  const file = File.build({
    fileId: randomDataGenerator.hash({
      length: constants.BUCKET_ID_LENGTH,
    }),
    id: randomDataGenerator.natural({ min: 1, max: 9999999 }),
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

export const newUser = (params?: {
  attributes?: Partial<UserAttributes>;
}): User => {
  const randomEmail = randomDataGenerator.email();

  const user = User.build({
    id: randomDataGenerator.natural({ max: 999999 }),
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
    rootFolderId: randomDataGenerator.natural({ max: 999999 }),
    errorLoginCount: 0,
    isEmailActivitySended: 0,
    lastResend: randomDataGenerator.date(),
    syncDate: randomDataGenerator.date(),
    welcomePack: false,
    registerCompleted: false,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    avatar: null,
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      user[key] = params.attributes[key];
    });

  return user;
};

export const newPreCreatedUser = (): PreCreatedUser => {
  const randomEmail = randomDataGenerator.email();

  return PreCreatedUser.build({
    id: randomDataGenerator.natural(),
    uuid: v4(),
    email: randomEmail,
    username: randomEmail,
    password: '',
    mnemonic: '',
    hKey: '',
    publicKey: '',
    privateKey: '',
    revocationKey: '',
    encryptVersion: UserKeysEncryptVersions.Ecc,
    privateKyberKey: 'private-kyber-key',
    publicKyberKey: 'public-kyber-key',
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
    type: bindTo?.sharingType ? bindTo.sharingType : SharingType.Private,
    id: v4(),
    itemId: bindTo?.item?.uuid || v4(),
    itemType: bindTo?.item instanceof File ? 'file' : 'folder',
    ownerId: bindTo?.owner?.uuid || v4(),
    sharedWith: bindTo?.sharedWith?.uuid || v4(),
    encryptedPassword: bindTo?.encryptedPassword || null,
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

export const newRole = (name?: string): Role => {
  return Role.build({
    id: v4(),
    name: name || 'EDITOR',
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

export const newWorkspace = (params?: {
  attributes?: Partial<Workspace>;
  owner?: User;
  avatar?: Workspace['avatar'];
}): Workspace => {
  const randomCreatedAt = randomDataGenerator.date();

  const workspace = Workspace.build({
    id: v4(),
    ownerId: params?.owner?.uuid || v4(),
    avatar: params?.avatar || null,
    address: randomDataGenerator.address(),
    name: randomDataGenerator.company(),
    description: randomDataGenerator.sentence(),
    defaultTeamId: v4(),
    workspaceUserId: v4(),
    setupCompleted: true,
    numberOfSeats: 20,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      workspace[key] = params.attributes[key];
    });

  return workspace;
};

export const newPermission = (bindTo?: {
  id?: string;
  roleId?: string;
  name?: SharingActionName;
}): Permission => {
  return Permission.build({
    id: bindTo?.id ?? v4(),
    roleId: bindTo?.roleId ?? v4(),
    name: bindTo?.name ?? SharingActionName.UploadFile,
  });
};

export const newWorkspaceTeam = (params?: {
  attributes?: Partial<WorkspaceTeam>;
  workspaceId?: string;
  manager?: User;
  mainTeam?: boolean;
}): WorkspaceTeam => {
  const randomCreatedAt = randomDataGenerator.date();
  const manager = params?.manager || newUser();
  const name = params?.mainTeam ? null : randomDataGenerator.word();

  const team = WorkspaceTeam.build({
    id: v4(),
    workspaceId: params?.workspaceId || v4(),
    managerId: manager.uuid,
    name,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      team[key] = params.attributes[key];
    });

  return team;
};

export const newWorkspaceTeamUser = (params?: {
  attributes?: Partial<WorkspaceTeamUser>;
  teamId?: string;
  memberId?: User['uuid'];
  team?: WorkspaceTeam;
}): WorkspaceTeamUser => {
  const randomCreatedAt = randomDataGenerator.date();
  const getTeamId = params?.teamId || v4();
  const team =
    params?.team ||
    newWorkspaceTeam({
      attributes: { id: getTeamId },
    });

  const teamUser = WorkspaceTeamUser.build({
    id: v4(),
    teamId: getTeamId,
    memberId: params?.memberId || v4(),
    team,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      teamUser[key] = params.attributes[key];
    });

  return teamUser;
};

export const newWorkspaceUser = (params?: {
  workspaceId?: string;
  memberId?: string;
  member?: User;
  attributes?: Partial<WorkspaceUser>;
}): WorkspaceUser => {
  const randomCreatedAt = randomDataGenerator.date();
  const spaceLimit = randomDataGenerator.natural({ min: 1, max: 1073741824 });

  const workspaceUser = WorkspaceUser.build({
    id: v4(),
    memberId: params?.memberId || v4(),
    member: params?.member,
    key: randomDataGenerator.string({ length: 32 }),
    workspaceId: params?.workspaceId || v4(),
    spaceLimit: spaceLimit,
    lastUsageSyncAt: new Date(),
    driveUsage: 0,
    backupsUsage: 0,
    deactivated: false,
    createdAt: randomCreatedAt,
    updatedAt: new Date(randomDataGenerator.date({ min: randomCreatedAt })),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      workspaceUser[key] = params.attributes[key];
    });

  return workspaceUser;
};

export const newWorkspaceInvite = (params?: {
  workspaceId?: string;
  invitedUser?: string;
  attributes?: Partial<WorkspaceInvite>;
}): WorkspaceInvite => {
  const defaultCreatedAt = new Date(randomDataGenerator.date({ year: 2024 }));

  const workspaceInvite = WorkspaceInvite.build({
    id: v4(),
    workspaceId: params?.workspaceId || v4(),
    invitedUser: params?.invitedUser || randomDataGenerator.email(),
    encryptionAlgorithm: 'AES-256',
    encryptionKey: randomDataGenerator.string({ length: 32 }),
    spaceLimit: randomDataGenerator.natural({ min: 1024, max: 1048576 }),
    createdAt: defaultCreatedAt,
    updatedAt: new Date(randomDataGenerator.date({ min: defaultCreatedAt })),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      workspaceInvite[key] = params.attributes[key];
    });

  return workspaceInvite;
};

export const newWorkspaceItemUser = (params?: {
  attributes?: Partial<WorkspaceItemUserAttributes>;
  workspaceId?: string;
  itemId?: string;
  itemType?: WorkspaceItemType;
  context?: WorkspaceItemContext;
  createdBy?: User['uuid'];
}): WorkspaceItemUser => {
  const randomCreatedAt = randomDataGenerator.date();

  const workspaceItemUser = WorkspaceItemUser.build({
    id: v4(),
    workspaceId: params?.workspaceId || v4(),
    itemId: params?.itemId || v4(),
    itemType: params?.itemType || WorkspaceItemType.Folder,
    context: params?.context || WorkspaceItemContext.Drive,
    createdBy: params?.createdBy || v4(),
    createdAt: randomCreatedAt,
    updatedAt: new Date(randomDataGenerator.date({ min: randomCreatedAt })),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      workspaceItemUser[key] = params.attributes[key];
    });

  return workspaceItemUser;
};

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

export const newKeyServer = (
  params?: Partial<KeyServerAttributes>,
): KeyServer => {
  const defaultAttributes: KeyServerAttributes = {
    id: randomDataGenerator.natural({ min: 1 }),
    userId: randomDataGenerator.natural({ min: 1 }),
    publicKey: randomDataGenerator.string({ length: 64 }),
    privateKey: randomDataGenerator.string({ length: 64 }),
    revocationKey: randomDataGenerator.string({ length: 64 }),
    encryptVersion: UserKeysEncryptVersions.Ecc,
  };

  const attributes: KeyServerAttributes = { ...defaultAttributes, ...params };

  if (attributes.encryptVersion !== UserKeysEncryptVersions.Ecc) {
    attributes.revocationKey = undefined;
  }

  return KeyServer.build(attributes);
};

export const newSharingInvite = (bindTo?: {
  itemId?: string;
  itemType?: 'file' | 'folder';
  sharedWith?: string;
  roleId?: string;
  type?: 'SELF' | 'OWNER';
  expirationAt?: Date;
}): SharingInvite => {
  return SharingInvite.build({
    id: v4(),
    itemId: bindTo?.itemId || v4(),
    itemType: bindTo?.itemType || 'file',
    sharedWith: bindTo?.sharedWith || v4(),
    encryptionKey: randomDataGenerator.string({ length: 32 }),
    encryptionAlgorithm: 'aes256',
    type: bindTo?.type || 'OWNER',
    roleId: bindTo?.roleId || v4(),
    createdAt: randomDataGenerator.date(),
    updatedAt: randomDataGenerator.date(),
    expirationAt: bindTo?.expirationAt || randomDataGenerator.date(),
  });
};

export const newDevice = (options?: Partial<DeviceAttributes>): Device => {
  const defaultAttributes: DeviceAttributes = {
    id: randomDataGenerator.natural({ min: 1 }),
    mac: '00:11:22:33:44:55',
    key: randomDataGenerator.string(),
    hostname: randomDataGenerator.string(),
    folderUuid: v4(),
    userId: randomDataGenerator.natural({ min: 1 }),
    name: randomDataGenerator.string(),
    platform: DevicePlatform.LINUX,
    createdAt: new Date('2022-01-01T00:00:00.000Z'),
    updatedAt: new Date('2022-01-01T00:00:00.000Z'),
  };

  const mergedAttributes = {
    ...defaultAttributes,
    ...options,
  };

  return new Device(mergedAttributes);
};

export const newUsage = (params?: { attributes?: Partial<Usage> }): Usage => {
  const randomCreatedAt = randomDataGenerator.date();
  const randomPeriod = randomDataGenerator.date();

  const usage = Usage.build({
    id: v4(),
    userId: v4(),
    delta: randomDataGenerator.integer({ min: 0, max: 1000 }),
    period: randomPeriod,
    type: UsageType.Daily,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      usage[key] = params.attributes[key];
    });

  return usage;
};

export const newNotification = (params?: {
  attributes?: Partial<Notification>;
}): Notification => {
  const randomCreatedAt = randomDataGenerator.date();
  const notification = Notification.build({
    id: v4(),
    link: randomDataGenerator.url(),
    message: randomDataGenerator.sentence(),
    targetType: 'all',
    targetValue: null,
    expiresAt: randomDataGenerator.date({ min: new Date() }) as Date,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
    ...params?.attributes,
  });

  return notification;
};

export const newUserNotificationStatus = (params?: {
  attributes?: Partial<UserNotificationStatus>;
  userId?: string;
  notificationId?: string;
}): UserNotificationStatus => {
  const randomCreatedAt = randomDataGenerator.date();

  const userNotificationStatus = UserNotificationStatus.build({
    id: v4(),
    userId: params?.userId || v4(),
    notificationId: params?.notificationId || v4(),
    deliveredAt: randomCreatedAt,
    readAt: null,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
    ...params?.attributes,
  });

  return userNotificationStatus;
};

export const newTier = (attributes?: Partial<Tier>): Tier => {
  const tier = Tier.build({
    id: v4(),
    label: randomDataGenerator.word(),
    context: randomDataGenerator.word(),
    ...attributes,
  });

  return tier;
};

export const newAuditLog = (params?: Partial<AuditLogAttributes>): AuditLog => {
  return new AuditLog({
    id: v4(),
    entityType: AuditEntityType.User,
    entityId: v4(),
    action: AuditAction.PasswordChanged,
    performerType: AuditPerformerType.User,
    performerId: v4(),
    createdAt: new Date(),
    metadata: params?.metadata || {},
    ...params,
  });
};

export const newTrash = (params?: {
  itemId?: string;
  itemType?: TrashItemType;
  caducityDate?: Date;
  userId?: number;
}): Trash => {
  const defaultCaducityDate = new Date();
  defaultCaducityDate.setDate(defaultCaducityDate.getDate() + 14);

  return Trash.build({
    itemId: params?.itemId || v4(),
    itemType: params?.itemType || TrashItemType.File,
    caducityDate: params?.caducityDate || defaultCaducityDate,
    userId: params?.userId || 1,
  });
};

export const newFileVersion = (params?: {
  attributes?: Partial<FileVersionAttributes>;
}): FileVersion => {
  const randomCreatedAt = randomDataGenerator.date();

  const fileVersion = FileVersion.build({
    id: v4(),
    fileId: v4(),
    userId: v4(),
    networkFileId: randomDataGenerator.hash({
      length: constants.BUCKET_ID_LENGTH,
    }),
    size: BigInt(randomDataGenerator.natural({ min: 1 })),
    status: FileVersionStatus.EXISTS,
    modificationTime: randomCreatedAt,
    createdAt: randomCreatedAt,
    updatedAt: new Date(
      randomDataGenerator.date({
        min: randomCreatedAt,
      }),
    ),
    ...params?.attributes,
  });

  return fileVersion;
};

type VersioningLimits = {
  enabled: boolean;
  maxFileSize: number;
  retentionDays: number;
  maxVersions: number;
};

export const newVersioningLimits = (
  params?: Partial<VersioningLimits>,
): VersioningLimits => ({
  enabled: params?.enabled ?? true,
  maxFileSize: params?.maxFileSize ?? 10 * 1024 * 1024,
  retentionDays: params?.retentionDays ?? 15,
  maxVersions: params?.maxVersions ?? 10,
});
