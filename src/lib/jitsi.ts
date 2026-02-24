import { type JwtHeader } from 'jsonwebtoken';
import { v4 } from 'uuid';
import getEnv from '../config/configuration';
import { type User } from '../modules/user/user.domain';

export const getJitsiJWTSecret = () => {
  return Buffer.from(getEnv().secrets.jitsiSecret, 'base64').toString('utf8');
};

export const getJitsiJWTPayload = (
  user: User,
  room: string,
  moderator: boolean,
) => {
  const now = new Date();
  const appId = getEnv().jitsi.appId;
  return {
    aud: 'jitsi',
    context: {
      user: {
        id: user?.id ?? v4(),
        name: user?.name ?? 'anonymous',
        email: user?.email ?? 'anonymous@internxt.com',
        avatar: '',
        moderator: moderator,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        'outbound-call': false,
      },
    },
    iss: 'chat',
    room: room,
    sub: appId,
    exp: Math.round(now.setMinutes(now.getMinutes() + 1) / 1000),
    nbf: Math.round(new Date().getTime() / 1000) - 10,
  };
};

export const getJitsiJWTHeader = () => {
  const header: JwtHeader = {
    alg: 'RS256',
    kid: getEnv().jitsi.apiKey,
    typ: 'JWT',
  };
  return header;
};
