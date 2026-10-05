import { signWithExpiry } from '../../middlewares/passport';
import getEnv from '../../config/configuration';

export const ACCOUNT_SETUP_TOKEN_ACTION = 'complete-account-setup';
const ACCOUNT_SETUP_TOKEN_EXPIRY = '5d';

export function buildAccountSetupUrl(
  uuid: string,
  sentAt: Date,
): { setupUrl: string; token: string } {
  const token = signWithExpiry(
    {
      payload: { uuid, action: ACCOUNT_SETUP_TOKEN_ACTION },
      iat: Math.floor(sentAt.getTime() / 1000),
    },
    getEnv().secrets.jwt,
    { expiresIn: ACCOUNT_SETUP_TOKEN_EXPIRY },
  );

  return {
    token,
    setupUrl: `${process.env.HOST_DRIVE_WEB}/complete-account/${token}`,
  };
}
