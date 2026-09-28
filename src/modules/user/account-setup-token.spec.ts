import { ForbiddenException } from '@nestjs/common';
import { decode, sign } from 'jsonwebtoken';
import { v4 } from 'uuid';
import * as jwtLibrary from '../../lib/jwt';
import {
  ACCOUNT_SETUP_TOKEN_ACTION,
  buildAccountSetupUrl,
  decodeAccountSetupToken,
  isCurrentAccountSetupToken,
  signAccountSetupToken,
} from './account-setup-token';

const FIVE_DAYS_IN_SECONDS = 5 * 24 * 60 * 60;
const secret = 'account-setup-test-secret';
const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

describe('Account setup token', () => {
  const uuid = v4();
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const signRawToken = (payload: object) =>
    sign(payload, secret, { expiresIn: '5d' });

  describe('Signing', () => {
    it('When a token is signed, then it identifies the user, is only valid for the account setup and expires 5 days after the email was sent', () => {
      const sentAt = new Date();

      const token = signAccountSetupToken(uuid, sentAt);

      const payload = decode(token) as {
        payload: { uuid: string; action: string };
        iat: number;
        exp: number;
      };
      expect(payload.payload).toEqual({
        uuid,
        action: ACCOUNT_SETUP_TOKEN_ACTION,
      });
      expect(payload.iat).toBe(toSeconds(sentAt));
      expect(payload.exp - payload.iat).toBe(FIVE_DAYS_IN_SECONDS);
    });

    it('When the setup url is built, then it points to the account completion page of the web app', () => {
      process.env.HOST_DRIVE_WEB = 'https://drive.internxt.com';

      const url = buildAccountSetupUrl('the-token');

      expect(url).toBe('https://drive.internxt.com/complete-account/the-token');
    });
  });

  describe('Decoding', () => {
    it('When the token is valid, then the user uuid and the moment it was issued are returned', () => {
      const sentAt = new Date();
      const token = signAccountSetupToken(uuid, sentAt);

      const decoded = decodeAccountSetupToken(token);

      expect(decoded).toEqual({ uuid, issuedAt: toSeconds(sentAt) });
    });

    it('When the token has expired, then access is denied as expired', () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const token = signAccountSetupToken(uuid, sixDaysAgo);

      expect(() => decodeAccountSetupToken(token)).toThrow(
        new ForbiddenException('Token expired'),
      );
    });

    it('When the token is signed with another secret, then access is denied as invalid', () => {
      const token = sign(
        { payload: { uuid, action: ACCOUNT_SETUP_TOKEN_ACTION } },
        'another-secret',
      );

      expect(() => decodeAccountSetupToken(token)).toThrow(
        new ForbiddenException('Invalid token'),
      );
    });

    it('When the token is not a JWT, then access is denied as invalid', () => {
      expect(() => decodeAccountSetupToken('not-a-token')).toThrow(
        new ForbiddenException('Invalid token'),
      );
    });

    it('When the token was issued for another purpose, then access is denied as invalid', () => {
      const token = signRawToken({
        payload: { uuid, action: 'reset-password' },
      });

      expect(() => decodeAccountSetupToken(token)).toThrow(
        new ForbiddenException('Invalid token'),
      );
    });

    it('When the token does not say when it was issued, then access is denied as invalid', () => {
      const token = sign(
        { payload: { uuid, action: ACCOUNT_SETUP_TOKEN_ACTION } },
        secret,
        { noTimestamp: true },
      );

      expect(() => decodeAccountSetupToken(token)).toThrow(
        new ForbiddenException('Invalid token'),
      );
    });

    it('When the token does not carry a valid user uuid, then access is denied as invalid', () => {
      const tokens = [
        signRawToken({
          payload: { uuid: 'not-a-uuid', action: ACCOUNT_SETUP_TOKEN_ACTION },
        }),
        signRawToken({ payload: { action: ACCOUNT_SETUP_TOKEN_ACTION } }),
      ];

      tokens.forEach((token) =>
        expect(() => decodeAccountSetupToken(token)).toThrow(
          new ForbiddenException('Invalid token'),
        ),
      );
    });

    it('When the token content is a plain string, then access is denied as invalid', () => {
      const token = sign('plain-string-payload', secret);

      expect(() => decodeAccountSetupToken(token)).toThrow(
        new ForbiddenException('Invalid token'),
      );
    });

    it('When verifying the token fails for an unexpected reason, then that error is not hidden', () => {
      const unexpectedError = new Error('Unexpected failure');
      jest.spyOn(jwtLibrary, 'verifyToken').mockImplementation(() => {
        throw unexpectedError;
      });

      expect(() => decodeAccountSetupToken('any-token')).toThrow(
        unexpectedError,
      );
    });
  });

  describe('Checking that the token belongs to the last email sent', () => {
    it('When no setup email was sent, then no token is current', () => {
      expect(isCurrentAccountSetupToken(toSeconds(new Date()), null)).toBe(
        false,
      );
    });

    it('When the token was issued in the same second the last email was sent, then it is current', () => {
      const setupEmailSentAt = new Date('2026-09-25T10:00:00.750Z');

      const isCurrent = isCurrentAccountSetupToken(
        toSeconds(new Date('2026-09-25T10:00:00.000Z')),
        setupEmailSentAt,
      );

      expect(isCurrent).toBe(true);
    });

    it('When a newer email was sent after the token was issued, then the token is no longer current', () => {
      const setupEmailSentAt = new Date('2026-09-25T10:00:01.000Z');

      const isCurrent = isCurrentAccountSetupToken(
        toSeconds(new Date('2026-09-25T10:00:00.000Z')),
        setupEmailSentAt,
      );

      expect(isCurrent).toBe(false);
    });
  });
});
