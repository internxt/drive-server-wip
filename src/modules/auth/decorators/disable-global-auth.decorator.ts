import { SetMetadata } from '@nestjs/common';
export const DisableGlobalAuth = () => SetMetadata('disableGlobalAuth', true);
