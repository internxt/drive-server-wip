import { signWithExpiry } from '../../middlewares/passport';
import getEnv from '../../config/configuration';
import { verifyWithDefaultSecret } from '../../lib/jwt';
import { type SharingInvite } from './sharing.domain';

export const GUEST_INVITE_TOKEN_ACTION = 'sharing-guest-signup';
const GUEST_INVITE_TOKEN_EXPIRY = '2d';

interface GuestInviteTokenPayload {
  invitationId: SharingInvite['id'];
  email: string;
}

export function signGuestInviteToken({
  invitationId,
  email,
}: GuestInviteTokenPayload): string {
  return signWithExpiry(
    {
      payload: {
        invitationId,
        email: email.toLowerCase(),
        action: GUEST_INVITE_TOKEN_ACTION,
      },
    },
    getEnv().secrets.jwt,
    { expiresIn: GUEST_INVITE_TOKEN_EXPIRY },
  );
}

export function decodeGuestInviteToken(
  token: string,
): GuestInviteTokenPayload | null {
  try {
    const decoded = verifyWithDefaultSecret(token) as {
      payload?: Partial<GuestInviteTokenPayload> & { action?: string };
    };

    if (
      typeof decoded === 'string' ||
      decoded?.payload?.action !== GUEST_INVITE_TOKEN_ACTION ||
      !decoded.payload.invitationId ||
      !decoded.payload.email
    ) {
      return null;
    }

    return {
      invitationId: decoded.payload.invitationId,
      email: decoded.payload.email,
    };
  } catch {
    return null;
  }
}
