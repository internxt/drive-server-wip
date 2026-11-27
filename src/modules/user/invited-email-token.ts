import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../../config/configuration';
import { verifyWithDefaultSecret } from '../../lib/jwt';

export const INVITED_EMAIL_TOKEN_ACTION = 'verify-invited-email';

export interface InvitedEmailToken {
  email: string;
  invitationId: string;
  type: 'sharing' | 'workspace';
}

export function signInvitedEmailToken(
  { email, invitationId, type }: InvitedEmailToken,
  expiresAt?: Date | null,
): string {
  return jwt.sign(
    {
      payload: {
        email: email.toLowerCase(),
        invitationId,
        type,
        action: INVITED_EMAIL_TOKEN_ACTION,
      },
      ...(expiresAt && { exp: Math.floor(expiresAt.getTime() / 1000) }),
    },
    getEnv().secrets.jwt,
    { jwtid: v4() },
  );
}

export function decodeInvitedEmailToken(
  token: string,
): InvitedEmailToken | null {
  try {
    const { payload } = verifyWithDefaultSecret(token) as {
      payload?: InvitedEmailToken & { action?: string };
    };

    if (payload?.action !== INVITED_EMAIL_TOKEN_ACTION) {
      return null;
    }

    const { email, invitationId, type } = payload;

    return { email, invitationId, type };
  } catch {
    return null;
  }
}
