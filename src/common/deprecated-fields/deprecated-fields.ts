import * as semver from 'semver';
import { getAsyncLocalStorage } from '../async-local-storage/async-local-storage';
import { ClientEnum } from '../enums/platform.enum';

export enum DeprecatedField {
  FILE_NAME = 'file.name',
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
    // Linux backups decrypt file.name, so it stays encrypted for every version.
    // Set minVersion to the first release that reads plainName instead.
    [ClientEnum.DesktopLinux]: {
      minVersion: '99.0.0',
      mode: DeprecationMode.PLAIN,
    },
  },
};

const DEFAULT_MODES: Record<DeprecatedField, DeprecationMode> = {
  [DeprecatedField.FILE_NAME]: DeprecationMode.PLAIN,
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
