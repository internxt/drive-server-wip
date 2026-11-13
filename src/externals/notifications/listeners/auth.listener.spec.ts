import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { type Request } from 'express';

import { AuthListener } from './auth.listener';
import { NewsletterService } from '../../newsletter';
import { SignUpSuccessEvent } from '../events/sign-up-success.event';
import { newUser } from '../../../../test/fixtures';
import { getLocation } from '../../../lib/location';

jest.mock('../../../lib/location');

const mockedGetLocation = jest.mocked(getLocation);

const newRequest = (headers: Record<string, unknown>, ip?: string): Request =>
  ({ headers, ip }) as unknown as Request;

describe('AuthListener', () => {
  let listener: AuthListener;
  let newsletterService: NewsletterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthListener],
    })
      .useMocker(createMock)
      .compile();

    listener = module.get<AuthListener>(AuthListener);
    newsletterService = module.get<NewsletterService>(NewsletterService);

    jest.spyOn(newsletterService, 'subscribe').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSignUpSuccess', () => {
    it('When the signup request can be geolocated, then it should subscribe the user with its ip and location', () => {
      const user = newUser();
      const req = newRequest({ 'cf-connecting-ip': '139.47.19.216' });

      mockedGetLocation.mockReturnValue({
        country: 'Spain',
        region: 'CT',
        city: 'Barcelona',
        timezone: 'Europe/Madrid',
      });

      listener.handleSignUpSuccess(new SignUpSuccessEvent(user, req));

      expect(mockedGetLocation).toHaveBeenCalledWith('139.47.19.216');
      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        user.email,
        undefined,
        {
          ip: '139.47.19.216',
          country: 'Spain',
          region: 'CT',
          city: 'Barcelona',
          timezone: 'Europe/Madrid',
        },
      );
    });

    it('When the ip cannot be geolocated, then it should still send the ip and the identifiers', () => {
      const user = newUser();
      const req = newRequest({}, '172.18.0.1');

      mockedGetLocation.mockReturnValue(null);

      listener.handleSignUpSuccess(new SignUpSuccessEvent(user, req));

      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        user.email,
        undefined,
        { ip: '172.18.0.1' },
      );
    });

    it('When the event carries no request, then it should subscribe the user without a location', () => {
      const user = newUser();

      listener.handleSignUpSuccess(new SignUpSuccessEvent(user));

      expect(mockedGetLocation).not.toHaveBeenCalled();
      expect(newsletterService.subscribe).toHaveBeenCalledWith(
        user.email,
        undefined,
        undefined,
      );
    });

    it('When the subscription fails, then it should not propagate the error', async () => {
      const user = newUser();
      jest
        .spyOn(newsletterService, 'subscribe')
        .mockRejectedValue(new Error('Klaviyo is down'));

      expect(() =>
        listener.handleSignUpSuccess(new SignUpSuccessEvent(user)),
      ).not.toThrow();

      await Promise.resolve();
    });
  });
});
