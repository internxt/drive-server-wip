import { ClientEnum } from './enums/platform.enum';

export enum PlatformName {
  CLI = 'cli',
  RCLONE = 'rclone',
}

export const ClientToPlatformMap: Partial<Record<ClientEnum, PlatformName>> = {
  [ClientEnum.Cli]: PlatformName.CLI,
  [ClientEnum.CliLegacy]: PlatformName.CLI,
  [ClientEnum.Rclone]: PlatformName.RCLONE,
};
