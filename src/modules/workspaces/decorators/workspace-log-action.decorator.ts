import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import {
  type WorkspaceLogGlobalActionType,
  type WorkspaceLogType,
} from '../attributes/workspace-logs.attributes';
import { WorkspacesLogsInterceptor } from './../interceptors/workspaces-logs.interceptor';

export const WorkspaceLogAction = (
  action: WorkspaceLogType | WorkspaceLogGlobalActionType,
) =>
  applyDecorators(
    SetMetadata('workspaceLogAction', action),
    UseInterceptors(WorkspacesLogsInterceptor),
  );
