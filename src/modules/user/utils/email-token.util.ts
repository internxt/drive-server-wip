import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../../../config/configuration';
import { verifyWithDefaultSecret } from '../../../lib/jwt';

export enum EmailTokenAction {
  Invitation = 'invitation',
}

export type EmailToken<T extends object = object> = { email: string } & T;

export function signEmailToken<T extends object>(
  action: EmailTokenAction,
  { email, ...data }: EmailToken<T>,
  expiresAt?: Date | null,
): string {
  return jwt.sign(
    {
      payload: { ...data, email: email.toLowerCase(), action },
      ...(expiresAt && { exp: Math.floor(expiresAt.getTime() / 1000) }),
    },
    getEnv().secrets.jwt,
    { jwtid: v4() },
  );
}

export function decodeEmailToken<T extends object = object>(
  action: EmailTokenAction,
  token: string,
): EmailToken<T> | null {
  try {
    const { payload } = verifyWithDefaultSecret(token) as {
      payload?: EmailToken<T> & { action?: string };
    };

    if (payload?.action !== action) {
      return null;
    }

    const { action: _action, ...emailToken } = payload;

    return emailToken as EmailToken<T>;
  } catch {
    return null;
  }
}
