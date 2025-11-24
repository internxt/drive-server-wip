export const VERSIONING_LABELS = {
  INDIVIDUAL_ESSENTIAL: 'essential_individual',
  INDIVIDUAL_PREMIUM: 'premium_individual',
  INDIVIDUAL_ULTIMATE: 'ultimate_individual',
  BUSINESS_STANDARD: 'standard_business',
  BUSINESS_PRO: 'pro_business',
} as const;

export enum VersionableFileExtensionEnum {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  CSV = 'csv',
}

export type VersionableFileExtension = VersionableFileExtensionEnum;

export const VERSIONABLE_FILE_EXTENSIONS = Object.values(
  VersionableFileExtensionEnum,
) as VersionableFileExtension[];

export const CONFIG = {
  [VERSIONING_LABELS.INDIVIDUAL_ESSENTIAL]: {
    maxFileSize: BigInt(1 * 1024 * 1024),
    retentionDays: 10,
    maxVersions: 1,
  },
  [VERSIONING_LABELS.INDIVIDUAL_PREMIUM]: {
    maxFileSize: BigInt(10 * 1024 * 1024),
    retentionDays: 15,
    maxVersions: 10,
  },
  [VERSIONING_LABELS.INDIVIDUAL_ULTIMATE]: {
    maxFileSize: BigInt(20 * 1024 * 1024),
    retentionDays: 30,
    maxVersions: 20,
  },
  [VERSIONING_LABELS.BUSINESS_STANDARD]: {
    maxFileSize: BigInt(10 * 1024 * 1024),
    retentionDays: 15,
    maxVersions: 10,
  },
  [VERSIONING_LABELS.BUSINESS_PRO]: {
    maxFileSize: BigInt(20 * 1024 * 1024),
    retentionDays: 30,
    maxVersions: 20,
  },
} as const;

export const VERSIONABLE_TIER_LABELS = Object.values(VERSIONING_LABELS);

export type TierLabel =
  (typeof VERSIONING_LABELS)[keyof typeof VERSIONING_LABELS];

export interface VersionTierConfig {
  maxFileSize: bigint;
  retentionDays: number;
  maxVersions: number;
}
