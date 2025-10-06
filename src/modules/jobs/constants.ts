export enum JobName {
  DELETED_ITEMS_CLEANUP = 'deleted-items-cleanup',
  INACTIVE_USERS_EMAIL = 'inactive-users-email',
}

export enum JobStatus {
  RUNNING = 'running',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

export const INACTIVE_USERS_EMAIL_CONFIG = {
  BATCH_SIZE: 500,
  CONCURRENT_EMAILS_PER_BATCH: 50,
} as const;
