import { newUser } from '../../../../test/fixtures';
import { UploadGuard } from './upload.guard';
import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { ClientEnum } from '../../../common/enums/platform.enum';

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
    const contextsThatShouldAllow = [
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': ClientEnum.Web,
          'internxt-version': '1.0',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': ClientEnum.Desktop, //macos
          'internxt-version': '2.6.0.72',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': 'any-other',
          'internxt-version': '1.0.0',
        },
      }),
    ];

    for (const context of contextsThatShouldAllow) {
      expect(guard.canActivate(context)).toBe(true);
    }
  });

  it('When headers are not valid, then it should allow access', () => {
    const contextsThatShouldAllow = [
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': ClientEnum.Web,
          'internxt-version': 'a.b.c',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-version': '1.3.0',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': '@internxt/cli',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {},
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': undefined,
          'internxt-version': undefined,
        },
      }),
    ];

    for (const context of contextsThatShouldAllow) {
      expect(guard.canActivate(context)).toBe(true);
    }
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

  it('When client is CLI and version is equal or greater than 1.5.1, then it should allow access', () => {
    const contextsThatShouldAllow = [
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': '@internxt/cli',
          'internxt-version': '1.5.1',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': '@internxt/cli',
          'internxt-version': '1.5.2',
        },
      }),
      createMockExecutionContext({
        user,
        headers: {
          'internxt-client': '@internxt/cli',
          'internxt-version': '1.33.0',
        },
      }),
    ];

    for (const context of contextsThatShouldAllow) {
      expect(guard.canActivate(context)).toBe(true);
    }
  });
});
