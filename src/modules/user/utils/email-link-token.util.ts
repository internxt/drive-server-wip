import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../../../config/configuration';
import { verifyWithDefaultSecret } from '../../../lib/jwt';

export enum EmailLinkTokenAction {
  Invitation = 'invitation',
}

export type EmailLinkToken<T extends object = object> = {
  email: string;
  action: EmailLinkTokenAction;
} & T;

export function signEmailLinkToken<T extends object>(
  action: EmailLinkTokenAction,
  { email, ...data }: { email: string } & T,
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

export function verifyEmailLinkToken<T extends object = object>(
  action: EmailLinkTokenAction,
  token: string,
): EmailLinkToken<T> | null {
  try {
    const { payload } = verifyWithDefaultSecret(token) as {
      payload?: EmailLinkToken<T>;
    };

    if (payload?.action !== action) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
