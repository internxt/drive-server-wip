import { SetMetadata } from '@nestjs/common';

export const SKIP_CLIENT_VERSION_CHECK_KEY = 'skipClientVersionCheck';
export const SkipClientVersionCheck = () =>
  SetMetadata(SKIP_CLIENT_VERSION_CHECK_KEY, true);
