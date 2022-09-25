import { Folder } from '../folder/folder.domain';

export interface UserAttributes {
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
  rootFolder?: any;
  hKey: Buffer;
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
  tempKey: string;
  avatar: string;
}

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
  _rootFolder: Folder;
  hKey: Buffer;
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
  tempKey: string;
  avatar: string;
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
    rootFolder,
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
    tempKey,
    avatar,
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
    this.rootFolder = rootFolder;
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
    this.tempKey = tempKey;
    this.avatar = avatar;
  }

  static build(user: UserAttributes): User {
    return new User(user);
  }

  set rootFolder(rootFolder) {
    if (rootFolder && !(rootFolder instanceof Folder)) {
      throw Error('rootFolder folder invalid');
    }
    this._rootFolder = rootFolder;
  }
  get rootFolder() {
    return this._rootFolder;
  }

  toJSON() {
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
    };
  }
}

export interface ReferralAttributes {
  id: number;
  key: string;
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
}
