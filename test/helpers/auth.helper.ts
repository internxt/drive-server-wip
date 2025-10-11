import { User } from '../../src/modules/user/user.domain';
import { Sign } from '../../src/middlewares/passport';
import { generateJWT } from '../../src/lib/jwt';
import getEnv from '../../src/config/configuration';

/**
 * Generate an authentication token for a user using the Sign method
 * This creates a JWT token with all the necessary user claims
 */
export function generateAuthToken(user: User, jwtSecret?: string): string {
  const secret = jwtSecret || getEnv().secrets.jwt;

  return Sign(
    {
      payload: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        name: user.name,
        lastname: user.lastname,
        username: user.username,
        sharedWorkspace: true,
        networkCredentials: {
          user: user.bridgeUser,
          pass: user.userId,
        },
      },
    },
    secret,
  );
}
