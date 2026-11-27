import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../../../config/configuration';
import { Time } from '../../../lib/time';
import {
  EmailLinkTokenAction,
  verifyEmailLinkToken,
  signEmailLinkToken,
} from './email-link-token.util';

describe('Email link token', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  const invitation = {
    email: 'Invited@Example.com',
    invitationId: v4(),
    type: 'sharing' as const,
  };

  it('When the token is verified, then it returns the email in lowercase and its action and data', () => {
    const token = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
    );

    const verified = verifyEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      token,
    );

    expect(verified).toEqual({
      email: 'invited@example.com',
      action: EmailLinkTokenAction.Invitation,
      invitationId: invitation.invitationId,
      type: 'sharing',
    });
  });

  it('When a token is signed, then it has a unique id', () => {
    const token = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
    );
    const anotherToken = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
    );

    const { jti } = jwt.decode(token) as { jti: string };
    const { jti: anotherJti } = jwt.decode(anotherToken) as { jti: string };
    expect(jti).toBeDefined();
    expect(jti).not.toBe(anotherJti);
  });

  it('When it is signed with an expiration, then the token expires at that time', () => {
    const expiresAt = Time.dateWithTimeAdded(2, 'day');

    const token = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
      expiresAt,
    );

    const { exp } = jwt.decode(token) as { exp: number };
    expect(exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });

  it('When it is signed without an expiration, then the token does not expire', () => {
    const token = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
    );

    const { exp } = jwt.decode(token) as { exp?: number };
    expect(exp).toBeUndefined();
  });

  it('When the token has expired, then it is not valid', () => {
    const token = signEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      invitation,
      Time.dateWithTimeAdded(-1, 'minute'),
    );

    const verified = verifyEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      token,
    );

    expect(verified).toBeNull();
  });

  it('When the token was signed for another action, then it is not valid', () => {
    const token = jwt.sign(
      { payload: { ...invitation, action: 'reset-password' } },
      getEnv().secrets.jwt,
    );

    const verified = verifyEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      token,
    );

    expect(verified).toBeNull();
  });

  it('When the token was signed with another secret, then it is not valid', () => {
    const token = jwt.sign(
      { payload: { ...invitation, action: EmailLinkTokenAction.Invitation } },
      'another-secret',
    );

    const verified = verifyEmailLinkToken(
      EmailLinkTokenAction.Invitation,
      token,
    );

    expect(verified).toBeNull();
  });
});
