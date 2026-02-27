export enum LimitLabels {
  MaxSharedItems = 'max-shared-items',
  MaxSharedItemInvites = 'max-shared-invites',
  CliAccess = 'cli-access',
  PlatformAccess = 'platform-access',
  FileVersionEnabled = 'file-version-enabled',
  FileVersionMaxSize = 'file-version-max-size',
  FileVersionRetentionDays = 'file-version-retention-days',
  FileVersionMaxNumber = 'file-version-max-number',
  MaxZeroSizeFiles = 'max-zero-size-files',
  RcloneAccess = 'rclone-access',
  TrashRetentionDays = 'trash-retention-days',
}

export enum LimitTypes {
  Boolean = 'boolean',
  Counter = 'counter',
}

export const PLAN_FREE_TIER_ID = 'free_000000';
export const PLAN_FREE_INDIVIDUAL_TIER_LABEL = 'free_individual';
export const DEFAULT_TRASH_RETENTION_DAYS = 2;
