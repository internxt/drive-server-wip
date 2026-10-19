jest.mock('newrelic', () => ({
  addCustomAttribute: jest.fn(),
  setUserID: jest.fn(),
}));

import newrelic from 'newrelic';
import { of } from 'rxjs';
import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { NewRelicInterceptor } from './newrelic.interceptor';

const buildContext = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, ...req }),
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  }) as unknown as ExecutionContext;

describe('NewRelicInterceptor', () => {
  const interceptor = new NewRelicInterceptor();
  const next: CallHandler = { handle: () => of(null) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('When the request has an authenticated user, then it adds the user id', () => {
    const context = buildContext({ user: { id: 1 } });

    interceptor.intercept(context, next);

    expect(newrelic.setUserID).toHaveBeenCalledWith('1');
  });

  it('When the request has no user, then it does not add the user id', () => {
    const context = buildContext({});

    interceptor.intercept(context, next);

    expect(newrelic.setUserID).not.toHaveBeenCalled();
  });

  it('When the request comes from the gateway strategy, then it does not add the user id', () => {
    const context = buildContext({ user: true });

    interceptor.intercept(context, next);

    expect(newrelic.setUserID).not.toHaveBeenCalled();
  });
});
