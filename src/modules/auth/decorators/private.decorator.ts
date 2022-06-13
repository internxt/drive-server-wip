import { SetMetadata } from '@nestjs/common';
export const Private = () => SetMetadata('isPublic', false);
