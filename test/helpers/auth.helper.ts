import { type User } from '../../src/modules/user/user.domain';
import { Sign } from '../../src/middlewares/passport';
import getEnv from '../../src/config/configuration';

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
