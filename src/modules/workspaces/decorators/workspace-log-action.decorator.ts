import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { WorkspaceLogType } from '../attributes/workspace-logs.attributes';
import { WorkspacesLogsInterceptor } from './../interceptors/workspaces-logs.interceptor';

export const WorkspaceLogAction = (action: WorkspaceLogType) =>
  applyDecorators(
    SetMetadata('workspaceLogAction', action),
    UseInterceptors(WorkspacesLogsInterceptor),
  );
