import { LimitLabels } from '../feature-limit/limits.enum';

export const FeatureNameLimitMap: Record<string, LimitLabels> = {
  cli: LimitLabels.CliAccess,
  rclone: LimitLabels.RcloneAccess,
};
