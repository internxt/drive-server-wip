import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ConditionalCaptchaGuard } from './conditional-captcha.guard';
import { type UserUseCases } from '../user/user.usecase';
import { type CaptchaService } from '../../externals/captcha/captcha.service';
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { newUser } from '../../../test/fixtures';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientHeaders } from '../../common/decorators/client.decorator';

describe('ConditionalCaptchaGuard', () => {
  let guard: ConditionalCaptchaGuard;
  let userUseCase: DeepMocked<UserUseCases>;
  let captchaService: DeepMocked<CaptchaService>;

  beforeEach(() => {
    userUseCase = createMock<UserUseCases>();
    captchaService = createMock<CaptchaService>();

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

      const captchaServiceSpy = jest.spyOn(captchaService, 'verifyCaptcha');
      jest
        .spyOn(userUseCase, 'findByEmail')
        .mockResolvedValue(buildUserWithErrorLoginCount(0));

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

        jest
          .spyOn(userUseCase, 'findByEmail')
          .mockResolvedValue(buildUserWithErrorLoginCount(6));
        const captchaServiceSpy = jest.spyOn(captchaService, 'verifyCaptcha');

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

      jest
        .spyOn(userUseCase, 'findByEmail')
        .mockResolvedValue(buildUserWithErrorLoginCount(6));
      jest.spyOn(captchaService, 'verifyCaptcha').mockResolvedValue(false);

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

      jest
        .spyOn(userUseCase, 'findByEmail')
        .mockResolvedValue(buildUserWithErrorLoginCount(6));
      const captchaServiceSpy = jest
        .spyOn(captchaService, 'verifyCaptcha')
        .mockResolvedValue(true);

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

      jest
        .spyOn(userUseCase, 'findByEmail')
        .mockResolvedValue(buildUserWithErrorLoginCount(6));

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

      jest
        .spyOn(userUseCase, 'findByEmail')
        .mockResolvedValue(buildUserWithErrorLoginCount(6));
      const captchaServiceSpy = jest
        .spyOn(captchaService, 'verifyCaptcha')
        .mockResolvedValue(true);

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
