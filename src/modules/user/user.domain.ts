import { UserToJsonDto } from './dto/user-to-json.dto';
import { UserAttributes } from './user.attributes';
export class User implements UserAttributes {
  id: number;
  userId: string;
  name: string;
  lastname: string;
  email: string;
  username: string;
  bridgeUser: string;
  password: string;
  mnemonic: string;
  rootFolderId: number;
  hKey: Buffer | string;
  secret_2FA: string;
  errorLoginCount: number;
  isEmailActivitySended: number;
  referralCode: string;
  referrer: string;
  syncDate: Date;
  uuid: string;
  lastResend: Date;
  credit: number;
  welcomePack: boolean;
  registerCompleted: boolean;
  backupsBucket: string;
  sharedWorkspace: boolean;
  avatar: string;
  lastPasswordChangedAt: Date;
  tierId: string;
  emailVerified: boolean;
  updatedAt: Date;
  createdAt: Date;
  isOpaqueEnabled: boolean;
  registrationRecord?: string;

  constructor({
    id,
    userId,
    name,
    lastname,
    email,
    username,
    bridgeUser,
    password,
    mnemonic,
    rootFolderId,
    hKey,
    secret_2FA,
    errorLoginCount,
    isEmailActivitySended,
    referralCode,
    referrer,
    syncDate,
    uuid,
    lastResend,
    credit,
    welcomePack,
    registerCompleted,
    backupsBucket,
    sharedWorkspace,
    avatar,
    lastPasswordChangedAt,
    tierId,
    emailVerified,
    updatedAt,
    createdAt,
    isOpaqueEnabled,
    registrationRecord,
  }: UserAttributes) {
    this.id = id;
    this.userId = userId;
    this.name = name;
    this.lastname = lastname;
    this.email = email;
    this.username = username;
    this.bridgeUser = bridgeUser;
    this.password = password;
    this.mnemonic = mnemonic;
    this.rootFolderId = rootFolderId;
    this.hKey = hKey;
    this.secret_2FA = secret_2FA;
    this.errorLoginCount = errorLoginCount;
    this.isEmailActivitySended = isEmailActivitySended;
    this.referralCode = referralCode;
    this.referrer = referrer;
    this.syncDate = syncDate;
    this.uuid = uuid;
    this.lastResend = lastResend;
    this.credit = credit;
    this.welcomePack = welcomePack;
    this.registerCompleted = registerCompleted;
    this.backupsBucket = backupsBucket;
    this.sharedWorkspace = sharedWorkspace;
    this.avatar = avatar;
    this.lastPasswordChangedAt = lastPasswordChangedAt;
    this.tierId = tierId;
    this.emailVerified = emailVerified;
    this.updatedAt = updatedAt;
    this.createdAt = createdAt;
    this.isOpaqueEnabled = isOpaqueEnabled;
    this.registrationRecord = registrationRecord;
  }

  static build(user: UserAttributes): User {
    return new User(user);
  }

  isGuestOnSharedWorkspace(): boolean {
    return this.email !== this.bridgeUser;
  }

  hasBackupsEnabled(): boolean {
    return !!this.backupsBucket;
  }

  toJSON(): UserToJsonDto {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      lastname: this.lastname,
      email: this.email,
      username: this.username,
      bridgeUser: this.bridgeUser,
      rootFolderId: this.rootFolderId,
      errorLoginCount: this.errorLoginCount,
      isEmailActivitySended: this.isEmailActivitySended,
      referralCode: this.referralCode,
      referrer: this.referrer,
      syncDate: this.syncDate,
      uuid: this.uuid,
      lastResend: this.lastResend,
      credit: this.credit,
      welcomePack: this.welcomePack,
      registerCompleted: this.registerCompleted,
      backupsBucket: this.backupsBucket,
      sharedWorkspace: this.sharedWorkspace,
      avatar: this.avatar,
      lastPasswordChangedAt: this.lastPasswordChangedAt,
      isOpaqueEnabled: this.isOpaqueEnabled,
    };
  }
}

export enum ReferralKey {
  CreateAccount = 'create-account',
  InstallMobileApp = 'install-mobile-app',
  ShareFile = 'share-file',
  InstallDesktopApp = 'install-desktop-app',
  InviteFriends = 'invite-friends',
  SubscribeToNewsletter = 'subscribe-to-newsletter',
  CompleteSurvey = 'complete-survey',
}

export interface ReferralAttributes {
  id: number;
  key: ReferralKey;
  type: 'storage';
  credit: number;
  steps: number;
  enabled: boolean;
}

export interface UserReferralAttributes {
  id: number;
  userId: UserAttributes['id'];
  referralId: ReferralAttributes['id'];
  referred: UserAttributes['email'];
  applied: boolean;
  startDate: Date;
}

export enum AccountTokenAction {
  Unblock = 'unblock-account',
  Recover = 'recover-account',
}
