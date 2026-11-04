import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import newrelic from 'newrelic';
import { getAsyncLocalStorage } from '../../common/async-local-storage/async-local-storage';
import { ClientVersionStatus } from './client-version-policy.domain';
import { ClientVersionUseCase } from './client-version.usecase';
import { SKIP_CLIENT_VERSION_CHECK_KEY } from './decorators/skip-client-version-check.decorator';

const CLIENT_VERSION_UNSUPPORTED = 'CLIENT_VERSION_UNSUPPORTED';

@Injectable()
export class ClientVersionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clientVersionUseCase: ClientVersionUseCase,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_CLIENT_VERSION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipCheck) {
      return true;
    }

    const { client, version } = getAsyncLocalStorage() ?? {};
    if (!client || !version) {
      return true;
    }

    const compatibility = this.clientVersionUseCase.getCompatibility(
      client,
      version,
    );

    if (compatibility.status === ClientVersionStatus.Unsupported) {
      // Guards run before interceptors, NewRelicInterceptor never tags these requests
      newrelic.addCustomAttributes({
        internxtClient: client,
        internxtVersion: version,
        errorCode: CLIENT_VERSION_UNSUPPORTED,
      });

      throw new ForbiddenException({
        message: compatibility.message,
        error: 'Forbidden',
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: CLIENT_VERSION_UNSUPPORTED,
        recommendedVersion: compatibility.recommendedVersion,
      });
    }

    return true;
  }
}
