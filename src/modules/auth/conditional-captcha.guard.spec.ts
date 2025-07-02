import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ConditionalCaptchaGuard } from './conditional-captcha.guard';
import { UserUseCases } from '../user/user.usecase';
import { CaptchaService } from 'src/externals/captcha/captcha.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { newUser } from '../../../test/fixtures';

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
      UnauthorizedException,
    );
  });

  describe('Error Login count', () => {
    it('When the error login count is less than the threshold, then it does nothing', async () => {
      const mockedUser = newUser();
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {},
        ips: [],
        ip: '127.0.0.1',
      });

      const captchaServiceSpy = jest.spyOn(captchaService, 'verifyCaptcha');
      jest.spyOn(userUseCase, 'findByEmail').mockResolvedValue({
        errorLoginCount: 0,
        isGuestOnSharedWorkspace: () => false,
        toJSON: undefined,
        ...mockedUser,
      });

      const canUserLogin = await guard.canActivate(context);

      expect(canUserLogin).toBeTruthy();
      expect(captchaServiceSpy).not.toHaveBeenCalled();
    });

    describe('The error log in count is more than the threshold', () => {
      it('When no captcha token is provided, then an error indicating so is thrown', async () => {
        const mockedUser = newUser();
        const context = createMockExecutionContext({
          body: {
            email: 'test@inxt.com',
          },
          headers: {},
          ips: [],
          ip: '127.0.0.1',
        });

        jest.spyOn(userUseCase, 'findByEmail').mockResolvedValue({
          ...mockedUser,
          errorLoginCount: 6,
          isGuestOnSharedWorkspace: () => false,
          toJSON: undefined,
        });
        const captchaServiceSpy = jest.spyOn(captchaService, 'verifyCaptcha');

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(captchaServiceSpy).not.toHaveBeenCalled();
      });
    });

    it('When the captcha token verification fails, the an error indicating so is thrown', async () => {
      const mockedUser = newUser();
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'expired-captcha-token',
        },
        ips: [],
        ip: '127.0.0.1',
      });

      jest.spyOn(userUseCase, 'findByEmail').mockResolvedValue({
        ...mockedUser,
        errorLoginCount: 6,
        isGuestOnSharedWorkspace: () => false,
        toJSON: undefined,
      });
      const captchaServiceSpy = jest
        .spyOn(captchaService, 'verifyCaptcha')
        .mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When the captcha token is successfully verified, then it can be activated', async () => {
      const mockedUser = newUser();
      const context = createMockExecutionContext({
        body: {
          email: 'test@inxt.com',
        },
        headers: {
          'x-internxt-captcha': 'valid-captcha-token',
        },
        ips: [],
        ip: '127.0.0.1',
      });

      jest.spyOn(userUseCase, 'findByEmail').mockResolvedValue({
        ...mockedUser,
        errorLoginCount: 6,
        isGuestOnSharedWorkspace: () => false,
        toJSON: undefined,
      });
      const captchaServiceSpy = jest
        .spyOn(captchaService, 'verifyCaptcha')
        .mockResolvedValue(true);

      const canActivate = await guard.canActivate(context);

      expect(captchaServiceSpy).toBeTruthy();
      expect(canActivate).toBeTruthy();
    });
  });
});

const createMockExecutionContext = (request: Partial<any>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;
