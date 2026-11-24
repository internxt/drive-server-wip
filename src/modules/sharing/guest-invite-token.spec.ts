import { v4 } from 'uuid';
import { sign } from 'jsonwebtoken';
import {
  decodeGuestInviteToken,
  signGuestInviteToken,
} from './guest-invite-token';

describe('Guest invite token', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const jwtSecret = 'guest-invite-test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('When a signed token is decoded, then it returns the invitation and the email', () => {
    const invitationId = v4();
    const token = signGuestInviteToken({
      invitationId,
      email: 'Invitee@Internxt.com',
    });

    const decoded = decodeGuestInviteToken(token);

    expect(decoded).toEqual({ invitationId, email: 'invitee@internxt.com' });
  });

  it('When the token is for another action, then it is rejected', () => {
    const token = sign(
      { payload: { invitationId: v4(), email: 'a@b.com', action: 'other' } },
      jwtSecret,
    );

    const decoded = decodeGuestInviteToken(token);

    expect(decoded).toBeNull();
  });

  it('When the token is signed with another secret, then it is rejected', () => {
    const token = sign(
      {
        payload: {
          invitationId: v4(),
          email: 'a@b.com',
          action: 'sharing-guest-signup',
        },
      },
      'another-secret',
    );

    const decoded = decodeGuestInviteToken(token);

    expect(decoded).toBeNull();
  });

  it('When the token is malformed, then it is rejected', () => {
    const decoded = decodeGuestInviteToken('not-a-token');

    expect(decoded).toBeNull();
  });
});
