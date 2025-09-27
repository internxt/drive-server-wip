/**
 * Feature limits that control user capabilities and quotas
 */
export enum FeatureLimits {
  MaxSharedItems = 'max-shared-items',
  MaxSharedItemInvites = 'max-shared-invites',
}

/**
 * Platform access control limits
 */
export enum PlatformAccessLimits {
  CliAccess = 'cli-access',
}

export type AllLimits = FeatureLimits | PlatformAccessLimits;

export enum LimitTypes {
  Boolean = 'boolean',
  Counter = 'counter',
}

export const PLAN_FREE_TIER_ID = 'free_000000';
