import { Sign } from '../../../src/middlewares/passport';

export const generateAuthToken = (user: any, jwtSecret: string) => {
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
          user: user.bridge_user,
          pass: user.user_id,
        },
      },
    },
    jwtSecret,
    true,
  );
};
