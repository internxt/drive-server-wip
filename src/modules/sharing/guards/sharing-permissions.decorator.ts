import { SetMetadata } from '@nestjs/common';
import { SharingActionName } from '../sharing.domain';
import { DataSource } from '../../../common/extract-data-from-request';

export interface PermissionsOptions {
  action: SharingActionName;
  dataSources?: DataSource[];
}

export const PermissionsMetadataName = 'permissionsData';

export const RequiredSharingPermissions = (
  action: SharingActionName,
  dataSources?: DataSource[],
) => SetMetadata(PermissionsMetadataName, { action, dataSources });
