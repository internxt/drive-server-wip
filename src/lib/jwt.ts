import { sign, SignOptions } from 'jsonwebtoken';

export function generateJWT(
  payload: Record<string, unknown>,
  duration: string, 
  secret: string, 
  algorithm: SignOptions['algorithm'] | 'default' = 'default'
): string {
  if (algorithm === 'default') {
    return sign(payload, Buffer.from(secret, 'base64').toString('utf8'), {
      expiresIn: duration,
    })
  } else {
    return sign(payload, Buffer.from(secret, 'base64').toString('utf8'), {
      algorithm,
      expiresIn: duration,
    });
  }
}
  