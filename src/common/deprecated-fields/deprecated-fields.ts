import * as semver from 'semver';
import { getAsyncLocalStorage } from '../async-local-storage/async-local-storage';
import { ClientEnum } from '../enums/platform.enum';

export enum DeprecatedField {
  FILE_NAME = 'file.name',
  FILE_ID = 'file.id',
}

export enum DeprecationMode {
  PLAIN = 'plain',
  OMIT = 'omit',
}

interface DeprecationRule {
  minVersion?: string;
  mode: DeprecationMode;
}

const DEPRECATION_RULES: Record<
  DeprecatedField,
  Partial<Record<ClientEnum, DeprecationRule>>
> = {
  [DeprecatedField.FILE_NAME]: {
    [ClientEnum.DesktopWindows]: {
      minVersion: '2.6.0',
      mode: DeprecationMode.PLAIN,
    },
    [ClientEnum.DesktopMacos]: {
      minVersion: '2.6.0',
      mode: DeprecationMode.PLAIN,
    },
    [ClientEnum.Cli]: {
      minVersion: '1.5.0',
      mode: DeprecationMode.PLAIN,
    },
    [ClientEnum.Rclone]: {
      mode: DeprecationMode.PLAIN,
    },
    // Linux backups decrypt file.name
    [ClientEnum.DesktopLinux]: {
      minVersion: '99.0.0',
      mode: DeprecationMode.PLAIN,
    },
  },
  [DeprecatedField.FILE_ID]: {
    [ClientEnum.Mobile]: {
      minVersion: '1.12.2',
      mode: DeprecationMode.OMIT,
    },
    [ClientEnum.DesktopWindows]: {
      minVersion: '2.7.3',
      mode: DeprecationMode.OMIT,
    },
    [ClientEnum.DesktopMacos]: {
      minVersion: '2.7.1',
      mode: DeprecationMode.OMIT,
    },
    [ClientEnum.DesktopLinux]: {
      minVersion: '2.7.1',
      mode: DeprecationMode.OMIT,
    },
  },
};

const DEFAULT_MODES: Record<DeprecatedField, DeprecationMode | null> = {
  [DeprecatedField.FILE_NAME]: DeprecationMode.PLAIN,
  [DeprecatedField.FILE_ID]: null,
};

export const getDeprecationMode = (
  field: DeprecatedField,
): DeprecationMode | null => {
  const ctx = getAsyncLocalStorage();
  if (!ctx) {
    return null;
  }
  const rule = ctx.client && DEPRECATION_RULES[field][ctx.client];
  if (!rule) {
    return DEFAULT_MODES[field];
  }
  if (!rule.minVersion) {
    return rule.mode;
  }
  return ctx.version && semver.gte(ctx.version, rule.minVersion)
    ? rule.mode
    : null;
};
