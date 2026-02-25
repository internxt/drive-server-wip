import { SetMetadata } from '@nestjs/common';
import { type SharingActionName } from '../sharing.domain';

export interface PermissionsOptions {
  action: SharingActionName;
}

export const PermissionsMetadataName = 'permissionsData';

export const RequiredSharingPermissions = (action: SharingActionName) =>
  SetMetadata(PermissionsMetadataName, { action });
