export enum LimitLabels {
  MaxSharedItems = 'max-shared-items',
  MaxSharedItemInvites = 'max-shared-invites',
  MaxFileUploadSize = 'max-file-upload-size',
}

export enum LimitTypes {
  Boolean = 'boolean',
  Counter = 'counter',
}

export const LimitsErrorCodes = {
  [LimitLabels.MaxSharedItems]: 'MAX_SHARED_ITEMS',
  [LimitLabels.MaxSharedItemInvites]: 'MAX_SHARED_INVITES',
  [LimitLabels.MaxFileUploadSize]: 'MAX_FILE_UPLOAD_SIZE',
  Default: 'TIER_LIMIT_REACHED',
};

export const PLAN_FREE_TIER_ID = 'free_000000';
