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
import { Workspace } from '../src/modules/workspaces/domains/workspaces.domain';
import { WorkspaceTeam } from '../src/modules/workspaces/domains/workspace-team.domain';
import { WorkspaceTeamUser } from '../src/modules/workspaces/domains/workspace-team-user.domain';
import { WorkspaceUser } from '../src/modules/workspaces/domains/workspace-user.domain';
import { WorkspaceInvite } from '../src/modules/workspaces/domains/workspace-invite.domain';
import { UserAttributes } from '../src/modules/user/user.attributes';

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
    modificationTime: undefined,
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
    avatar: null,
    lastPasswordChangedAt: new Date(),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      user[key] = params.attributes[key];
    });

  return user;
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

export const newWorkspace = (params?: {
  attributes?: Partial<Workspace>;
  owner?: User;
}): Workspace => {
  const randomCreatedAt = randomDataGenerator.date();

  const workspace = Workspace.build({
    id: v4(),
    ownerId: params?.owner?.uuid || v4(),
    address: randomDataGenerator.address(),
    name: randomDataGenerator.company(),
    description: randomDataGenerator.sentence(),
    defaultTeamId: v4(),
    workspaceUserId: v4(),
    setupCompleted: true,
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
    spaceLimit: BigInt(spaceLimit),
    driveUsage: BigInt(
      randomDataGenerator.natural({ min: 1, max: spaceLimit }),
    ),
    backupsUsage: BigInt(
      randomDataGenerator.natural({ min: 1, max: spaceLimit }),
    ),
    deactivated: randomDataGenerator.bool(),
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
    spaceLimit: BigInt(
      randomDataGenerator.natural({ min: 1024, max: 1048576 }),
    ),
    createdAt: defaultCreatedAt,
    updatedAt: new Date(randomDataGenerator.date({ min: defaultCreatedAt })),
  });

  params?.attributes &&
    Object.keys(params.attributes).forEach((key) => {
      workspaceInvite[key] = params.attributes[key];
    });

  return workspaceInvite;
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
