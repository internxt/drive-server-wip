import { SetMetadata } from '@nestjs/common';

export enum WorkspaceRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  MEMBER = 'member',
}

export enum AccessContext {
  WORKSPACE = 'workspace',
  TEAM = 'team',
}

export const WorkspaceContextIdFieldName = {
  [AccessContext.WORKSPACE]: 'workspaceId',
  [AccessContext.TEAM]: 'teamId',
};

export interface AccessOptions {
  accessContext: AccessContext;
  requiredRole: WorkspaceRole;
  idSource: 'params' | 'body' | 'query';
}

export const WorkspaceRequiredAccess = (
  accessContext: AccessContext,
  requiredRole: WorkspaceRole,
  idSource: 'params' | 'body' | 'query' = 'params',
) => SetMetadata('accessControl', { accessContext, requiredRole, idSource });
