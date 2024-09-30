import { sign, SignOptions, verify } from 'jsonwebtoken';
import getEnv from '../config/configuration';
import { SignWithRS256AndHeader } from '../middlewares/passport';
import {
  getJitsiJWTHeader,
  getJitsiJWTPayload,
  getJitsiJWTSecret,
} from './jitsi';
import { User } from '../modules/user/user.domain';

export function generateJWT(
  payload: Record<string, unknown>,
  duration: string,
  secret: string,
  algorithm: SignOptions['algorithm'] | 'default' = 'default',
): string {
  if (algorithm === 'default') {
    return sign(payload, Buffer.from(secret, 'base64').toString('utf8'), {
      expiresIn: duration,
    });
  } else {
    return sign(payload, Buffer.from(secret, 'base64').toString('utf8'), {
      algorithm,
      expiresIn: duration,
    });
  }
}

export function generateTokenWithPlainSecret(
  payload: Record<string, unknown>,
  duration: string,
  secret: string,
) {
  return sign(payload, secret, { expiresIn: duration });
}

export function generateWithDefaultSecret(
  payload: Record<string, unknown>,
  duration: string,
) {
  return generateTokenWithPlainSecret(payload, duration, getEnv().secrets.jwt);
}

export function verifyToken(token: string, secret: string) {
  return verify(token, secret);
}

export function verifyWithDefaultSecret(token: string) {
  return verify(token, getEnv().secrets.jwt);
}

export function getTokenDefaultIat() {
  return Math.floor(Date.now() / 1000);
}

export function isTokenIatGreaterThanDate(date: Date, iat: number) {
  return Math.floor(date.getTime() / 1000) < iat;
}

export function generateJitsiJWT(user: User, room: string, moderator: boolean) {
  return SignWithRS256AndHeader(
    getJitsiJWTPayload(user, room, moderator),
    getJitsiJWTSecret(),
    getJitsiJWTHeader(),
  );
}
