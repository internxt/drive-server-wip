import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  applyDecorators,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SequelizeWorkspaceRepository } from '../repositories/workspaces.repository';
import {
  WorkspaceLogAttributes,
  WorkspaceLogPlatform,
} from '../attributes/workspace-logs.attributes';

@Injectable()
export class WorkspacesLogsInterceptor implements NestInterceptor {
  constructor(
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    private readonly logAction: WorkspaceLogAttributes['type'],
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const client = request.headers['internxt-client'];

    let platform: WorkspaceLogPlatform;

    switch (client) {
      case 'drive-web':
        platform = WorkspaceLogPlatform.WEB;
        break;
      case 'drive-mobile':
        platform = WorkspaceLogPlatform.MOBILE;
        break;
      case 'drive-desktop':
        platform = WorkspaceLogPlatform.DESKTOP;
        break;
      default:
        platform = WorkspaceLogPlatform.UNSPECIFIED;
    }

    return next.handle().pipe(
      tap({
        next: async () => {
          await this.workspaceRepository.registerLog({
            platform,
            creator: user.id,
            type: this.logAction,
            workspaceId: request.params.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        },
      }),
    );
  }
}

export function LogAction(logAction: WorkspaceLogAttributes['type']) {
  return applyDecorators(
    UseInterceptors(WorkspacesLogsInterceptor),
    (target: any, key: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      descriptor.value = function (...args: any[]) {
        const context = args[0];
        const workspaceRepository = context
          .switchToHttp()
          .getRequest()
          .app.get(SequelizeWorkspaceRepository);
        const interceptor = new WorkspacesLogsInterceptor(
          workspaceRepository,
          logAction,
        );
        return interceptor.intercept(context, originalMethod.apply(this, args));
      };
    },
  );
}
