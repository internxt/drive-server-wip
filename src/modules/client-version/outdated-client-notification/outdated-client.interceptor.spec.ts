import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { newUser } from '../../../../test/fixtures';
import * as asyncLocalStorage from '../../../common/async-local-storage/async-local-storage';
import { ClientEnum } from '../../../common/enums/platform.enum';
import { type OutdatedClientNotificationService } from './outdated-client-notification.service';
import { OutdatedClientInterceptor } from './outdated-client.interceptor';

const user = newUser();

const contextWithUser = (requestUser: unknown) => {
  const context = createMock<ExecutionContext>();
  context.switchToHttp().getRequest.mockReturnValue({ user: requestUser });
  return context;
};

describe('OutdatedClientInterceptor', () => {
  let interceptor: OutdatedClientInterceptor;
  let notificationService: DeepMocked<OutdatedClientNotificationService>;
  let next: DeepMocked<CallHandler>;

  beforeEach(() => {
    notificationService = createMock<OutdatedClientNotificationService>();
    next = createMock<CallHandler>();
    next.handle.mockReturnValue(of('response'));
    interceptor = new OutdatedClientInterceptor(notificationService);
    jest.spyOn(asyncLocalStorage, 'getAsyncLocalStorage').mockReturnValue({
      client: ClientEnum.Cli,
      version: '1.0.0',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When a logged in user makes a request with a known app version, then the user is checked for outdated app', () => {
    const context = contextWithUser(user);

    interceptor.intercept(context, next);

    expect(notificationService.notifyIfOutdated).toHaveBeenCalledWith(
      user,
      ClientEnum.Cli,
      '1.0.0',
    );
    expect(next.handle).toHaveBeenCalled();
  });

  it('When the request has no user, then nobody is notified', () => {
    const context = contextWithUser(undefined);

    interceptor.intercept(context, next);

    expect(notificationService.notifyIfOutdated).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });

  it('When the request comes from the gateway, then nobody is notified', () => {
    const context = contextWithUser(true);

    interceptor.intercept(context, next);

    expect(notificationService.notifyIfOutdated).not.toHaveBeenCalled();
  });

  it('When the request does not say which app version it comes from, then nobody is notified', () => {
    jest
      .spyOn(asyncLocalStorage, 'getAsyncLocalStorage')
      .mockReturnValue({ client: ClientEnum.Cli, version: null });
    const context = contextWithUser(user);

    interceptor.intercept(context, next);

    expect(notificationService.notifyIfOutdated).not.toHaveBeenCalled();
  });
});
