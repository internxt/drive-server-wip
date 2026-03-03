import { beforeEach, describe, expect, it } from 'vitest';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { ConditionalCaptchaGuard } from './conditional-captcha.guard';
import { UserUseCases } from '../user/user.usecase';
import { CaptchaService } from '../../externals/captcha/captcha.service';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { newUser } from '../../../test/fixtures';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientHeaders } from '../../common/decorators/client.decorator';

describe('ConditionalCaptchaGuard', () => {
  let guard: ConditionalCaptchaGuard;
  let userUseCase: DeepMockProxy<UserUseCases>;
  let captchaService: DeepMockProxy<CaptchaService>;

  beforeEach(() => {
    userUseCase = mockDeep<UserUseCases>();
    captchaService = mockDeep<CaptchaService>();

    guard = new ConditionalCaptchaGuard(userUseCase, captchaService);
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('When there is no email in the body request, then an error indicating so is thrown', async () => {
    const context = createMockExecutionContext({
      body: {},
      headers: {},
      ips: [],
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('Error Login count', () => {
    it('When the error login count is less than the threshold, then it does nothing', async () => {
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          [ClientHeaders.CLIENT_ID]: ClientEnum['Web'],
        },
        ips: [],
        ip: '127.0.0.1',
      });

      const captchaServiceSpy = captchaService.verifyCaptcha;
      userUseCase.findByEmail.mockResolvedValue(
        buildUserWithErrorLoginCount(0),
      );

      const canUserLogin = await guard.canActivate(context);

      expect(canUserLogin).toBeTruthy();
      expect(captchaServiceSpy).not.toHaveBeenCalled();
    });

    describe('The error log in count is more than the threshold', () => {
      it('When no captcha token is provided, then an error indicating so is thrown', async () => {
        const context = createMockExecutionContext({
          body: {
            email: 'test@inxt.com',
          },
          headers: {
            [ClientHeaders.CLIENT_ID]: ClientEnum['Web'],
          },
          ips: [],
          ip: '127.0.0.1',
        });

        userUseCase.findByEmail.mockResolvedValue(
          buildUserWithErrorLoginCount(6),
        );
        const captchaServiceSpy = captchaService.verifyCaptcha;

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
        expect(captchaServiceSpy).not.toHaveBeenCalled();
      });
    });

    it('When the captcha token verification fails, the an error indicating so is thrown', async () => {
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'expired-captcha-token',
          [ClientHeaders.CLIENT_ID]: ClientEnum['Web'],
        },
        ips: [],
        ip: '127.0.0.1',
      });

      userUseCase.findByEmail.mockResolvedValue(
        buildUserWithErrorLoginCount(6),
      );
      captchaService.verifyCaptcha.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When the captcha token is successfully verified, then it can be activated', async () => {
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'valid-captcha-token',
          [ClientHeaders.CLIENT_ID]: ClientEnum['Web'],
        },
        ips: [],
        ip: '127.0.0.1',
      });

      userUseCase.findByEmail.mockResolvedValue(
        buildUserWithErrorLoginCount(6),
      );
      const captchaServiceSpy =
        captchaService.verifyCaptcha.mockResolvedValue(true);

      const canActivate = await guard.canActivate(context);

      expect(captchaServiceSpy).toBeTruthy();
      expect(canActivate).toBeTruthy();
    });
  });

  describe('Checking the internxt client', () => {
    it('When the internxt client is not web, then an error indicating so is thrown', async () => {
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'valid-captcha-token',
          [ClientHeaders.CLIENT_ID]: ClientEnum['Desktop'],
        },
        ips: [],
        ip: '127.0.0.1',
      });

      userUseCase.findByEmail.mockResolvedValue(
        buildUserWithErrorLoginCount(6),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('When the internxt client is web, then the captcha token should be verified', async () => {
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'valid-captcha-token',
          [ClientHeaders.CLIENT_ID]: ClientEnum['Web'],
        },
        ips: [],
        ip: '127.0.0.1',
      });

      userUseCase.findByEmail.mockResolvedValue(
        buildUserWithErrorLoginCount(6),
      );
      const captchaServiceSpy =
        captchaService.verifyCaptcha.mockResolvedValue(true);

      await guard.canActivate(context);

      expect(captchaServiceSpy).toHaveBeenCalled();
    });
  });
});

const createMockExecutionContext = (request: Partial<any>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

const buildUserWithErrorLoginCount = (count: number) => ({
  ...newUser(),
  errorLoginCount: count,
  isGuestOnSharedWorkspace: () => false,
  toJSON: undefined,
  hasBackupsEnabled: () => false,
});
