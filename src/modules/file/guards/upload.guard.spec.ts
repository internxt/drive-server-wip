import { newUser } from '../../../../test/fixtures';
import { UploadGuard } from './upload.guard';
import { BadRequestException, ExecutionContext } from '@nestjs/common';

const user = newUser();

describe('UploadFileGuard', () => {
  let guard: UploadGuard;

  const createMockExecutionContext = (requestData: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestData,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    guard = new UploadGuard();
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('When no context is defined, then it should allow access', () => {
    const context = createMockExecutionContext({});

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('When client is web or any other, then it should allow access', () => {
    const contextWeb = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': 'drive-web',
        'internxt-version': '1.0',
      },
    });
    const contextAny = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': 'any',
        'internxt-version': 'any',
      },
    });

    const resultWeb = guard.canActivate(contextWeb);
    expect(resultWeb).toBe(true);

    const resultAny = guard.canActivate(contextAny);
    expect(resultAny).toBe(true);
  });

  it('When client is CLI and version is lower than 1.5.1, then it should throw BadRequestException', () => {
    const context = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': '@internxt/cli',
        'internxt-version': '1.5.0',
      },
    });

    const context2 = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': '@internxt/cli',
        'internxt-version': '1.3.0',
      },
    });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);

    expect(() => guard.canActivate(context2)).toThrow(BadRequestException);
  });

  it('When client is CLI and version is equal or greater than 1.5.0, then it should allow access', () => {
    const contextEqual = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': '@internxt/cli',
        'internxt-version': '1.5.1',
      },
    });
    const contextGreater = createMockExecutionContext({
      user,
      headers: {
        'internxt-client': '@internxt/cli',
        'internxt-version': '1.33.0',
      },
    });

    const resultEqual = guard.canActivate(contextEqual);
    expect(resultEqual).toBe(true);

    const resultGreater = guard.canActivate(contextGreater);
    expect(resultGreater).toBe(true);
  });
});
