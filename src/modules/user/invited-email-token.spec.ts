import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../../config/configuration';
import { Time } from '../../lib/time';
import {
  INVITED_EMAIL_TOKEN_ACTION,
  decodeInvitedEmailToken,
  signInvitedEmailToken,
} from './invited-email-token';

describe('Invited email token', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  const payload = {
    email: 'Invited@Example.com',
    invitationId: v4(),
    type: 'sharing' as const,
  };

  it('When the token is decoded, then it returns the email in lowercase, the invitation and its type', () => {
    const token = signInvitedEmailToken(payload);

    const decoded = decodeInvitedEmailToken(token);

    expect(decoded).toEqual({
      email: 'invited@example.com',
      invitationId: payload.invitationId,
      type: 'sharing',
    });
  });

  it('When the invitation has an expiration, then the token expires at the same time', () => {
    const expiresAt = Time.dateWithTimeAdded(2, 'day');

    const token = signInvitedEmailToken(payload, expiresAt);

    const { exp } = jwt.decode(token) as { exp: number };
    expect(exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });

  it('When the invitation has no expiration, then the token does not expire', () => {
    const token = signInvitedEmailToken({ ...payload, type: 'workspace' });

    const { exp } = jwt.decode(token) as { exp?: number };
    expect(exp).toBeUndefined();
  });

  it('When a token is signed, then it has a unique id', () => {
    const token = signInvitedEmailToken(payload);
    const anotherToken = signInvitedEmailToken(payload);

    const { jti } = jwt.decode(token) as { jti: string };
    const { jti: anotherJti } = jwt.decode(anotherToken) as { jti: string };
    expect(jti).toBeDefined();
    expect(jti).not.toBe(anotherJti);
  });

  it('When the token has expired, then it is not valid', () => {
    const token = signInvitedEmailToken(
      payload,
      Time.dateWithTimeAdded(-1, 'minute'),
    );

    const decoded = decodeInvitedEmailToken(token);

    expect(decoded).toBeNull();
  });

  it('When the token was signed for another action, then it is not valid', () => {
    const token = jwt.sign(
      { payload: { ...payload, action: 'complete-account-setup' } },
      getEnv().secrets.jwt,
    );

    const decoded = decodeInvitedEmailToken(token);

    expect(decoded).toBeNull();
  });

  it('When the token was signed with another secret, then it is not valid', () => {
    const token = jwt.sign(
      { payload: { ...payload, action: INVITED_EMAIL_TOKEN_ACTION } },
      'another-secret',
    );

    const decoded = decodeInvitedEmailToken(token);

    expect(decoded).toBeNull();
  });
});
