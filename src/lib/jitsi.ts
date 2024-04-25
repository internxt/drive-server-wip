import { JwtHeader } from 'jsonwebtoken';

export const getJitsiJWTSecret = () => {
  return 'private-key';
};

export const getJitsiJWTPayload = (id: string, name: string, email: string) => {
  const now = new Date();
  const appId = 'vpaas-magic-cookie-uuid_appId';
  return {
    aud: 'jitsi',
    context: {
      user: {
        id,
        name,
        avatar: '',
        email,
        moderator: 'true',
      },
      features: {
        livestreaming: 'true',
        recording: 'true',
        transcription: 'true',
        'outbound-call': 'true',
      },
    },
    iss: 'chat',
    room: '*',
    sub: appId,
    exp: Math.round(now.setHours(now.getHours() + 3) / 1000),
    nbf: Math.round(now.getTime() / 1000) - 10,
  };
};

export const getJitsiJWTHeader = () => {
  const header: JwtHeader = {
    alg: 'RS256',
    kid: 'vpaas-magic-cookie-uuid_apikey',
    typ: 'JWT',
  };
  return header;
};
