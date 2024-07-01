export interface UserToJsonDto {
  [key: string]: unknown;
  id: number;
  userId: string;
  name: string;
  lastname: string;
  email: string;
  username: string;
  bridgeUser: string;
  rootFolderId: number;
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
  lastPasswordChangedAt?: Date;
}
