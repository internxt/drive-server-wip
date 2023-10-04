import { sign, SignOptions, verify } from 'jsonwebtoken';
import getEnv from '../config/configuration';

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
