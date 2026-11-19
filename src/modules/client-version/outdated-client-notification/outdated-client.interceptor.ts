import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { getAsyncLocalStorage } from '../../../common/async-local-storage/async-local-storage';
import { type User } from '../../user/user.domain';
import { OutdatedClientNotificationService } from './outdated-client-notification.service';

@Injectable()
export class OutdatedClientInterceptor implements NestInterceptor {
  constructor(
    private readonly outdatedClientNotificationService: OutdatedClientNotificationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const { client, version } = getAsyncLocalStorage() ?? {};
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: User | boolean }>();

    // Gateway requests have no user
    if (client && version && typeof user === 'object') {
      this.outdatedClientNotificationService.notifyIfOutdated(
        user,
        client,
        version,
      );
    }

    return next.handle();
  }
}
