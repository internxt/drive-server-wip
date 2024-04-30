import { JwtHeader } from 'jsonwebtoken';
import getEnv from '../config/configuration';

export const getJitsiJWTSecret = () => {
  return Buffer.from(getEnv().secrets.jitsiSecret, 'base64').toString('utf8');
};

export const getJitsiJWTPayload = (id: string, name: string, email: string) => {
  const now = new Date();
  const appId = getEnv().jitsi.appId;
  return {
    aud: 'jitsi',
    context: {
      user: {
        id,
        name,
        email,
        avatar: '',
        moderator: true,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        'outbound-call': false,
      },
    },
    iss: 'chat',
    room: '*',
    sub: appId,
    exp: Math.round(now.setHours(now.getHours() + 3) / 1000),
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
