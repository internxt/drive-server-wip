import { ForbiddenException } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { validate } from 'uuid';
import getEnv from '../../config/configuration';
import { Sign } from '../../middlewares/passport';
import { verifyToken } from '../../lib/jwt';
import { type PreCreatedUserAttributes } from './pre-created-users.attributes';

export const ACCOUNT_SETUP_TOKEN_ACTION = 'complete-account-setup';
export const ACCOUNT_SETUP_TOKEN_EXPIRATION = '5d';

interface AccountSetupTokenPayload {
  iat?: number;
  payload?: { uuid?: string; action?: string };
}

const toSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

/**
 * Signs the token sent in the account setup email. Its `iat` is the moment
 * the email was sent, so only the token of the last email sent is valid
 * (see `isCurrentAccountSetupToken`).
 */
export function signAccountSetupToken(
  uuid: PreCreatedUserAttributes['uuid'],
  sentAt: Date,
): string {
  return Sign(
    {
      payload: { uuid, action: ACCOUNT_SETUP_TOKEN_ACTION },
      iat: toSeconds(sentAt),
    },
    getEnv().secrets.jwt,
    ACCOUNT_SETUP_TOKEN_EXPIRATION,
  );
}

export function buildAccountSetupUrl(token: string): string {
  return `${process.env.HOST_DRIVE_WEB}/complete-account/${token}`;
}

/**
 * Verifies signature, expiration and structure of an account setup token.
 * It does not check that the pre-created user still exists nor that the
 * token belongs to the last email sent: callers do it with
 * `isCurrentAccountSetupToken`.
 */
export function decodeAccountSetupToken(token: string): {
  uuid: PreCreatedUserAttributes['uuid'];
  issuedAt: number;
} {
  let decoded: AccountSetupTokenPayload | string;

  try {
    decoded = verifyToken<AccountSetupTokenPayload>(
      token,
      getEnv().secrets.jwt,
    );
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new ForbiddenException('Token expired');
    }
    if (error instanceof JsonWebTokenError) {
      throw new ForbiddenException('Invalid token');
    }
    throw error;
  }

  const uuid = typeof decoded === 'string' ? undefined : decoded.payload?.uuid;
  const isValidStructure =
    typeof decoded !== 'string' &&
    decoded.payload?.action === ACCOUNT_SETUP_TOKEN_ACTION &&
    decoded.iat !== undefined &&
    !!uuid &&
    validate(uuid);

  if (!isValidStructure) {
    throw new ForbiddenException('Invalid token');
  }

  return { uuid, issuedAt: (decoded as AccountSetupTokenPayload).iat };
}

export function isCurrentAccountSetupToken(
  issuedAt: number,
  setupEmailSentAt: PreCreatedUserAttributes['setupEmailSentAt'],
): boolean {
  return !!setupEmailSentAt && toSeconds(setupEmailSentAt) === issuedAt;
}
