import { JwtPayload, sign, verify } from 'jsonwebtoken';
import getEnv from '../config/configuration';
import { SignWithRS256AndHeader } from '../middlewares/passport';
import {
  getJitsiJWTHeader,
  getJitsiJWTPayload,
  getJitsiJWTSecret,
} from './jitsi';
import { User } from '../modules/user/user.domain';

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

export function verifyToken<T = JwtPayload>(
  token: string,
  secret: string,
): T | string {
  return verify(token, secret) as T | string;
}

export function verifyWithDefaultSecret(token: string) {
  return verify(token, getEnv().secrets.jwt);
}

export function getTokenDefaultIat() {
  return Math.floor(Date.now() / 1000);
}

export function generateJitsiJWT(user: User, room: string, moderator: boolean) {
  return SignWithRS256AndHeader(
    getJitsiJWTPayload(user, room, moderator),
    getJitsiJWTSecret(),
    getJitsiJWTHeader(),
  );
}
