import jwt, { JwtHeader } from 'jsonwebtoken';
import passport from 'passport';

export const passportAuth = passport.authenticate('jwt', { session: false });

export function SignEmail(
  email: string,
  secret: string,
  expires = false,
): string {
  const token = expires
    ? jwt.sign({ email }, secret, { expiresIn: '14d' })
    : jwt.sign({ email }, secret);

  return token;
}

export function Sign(payload: object, secret: string, expires = false): string {
  const token = expires
    ? jwt.sign(payload, secret, { expiresIn: '14d' })
    : jwt.sign(payload, secret);

  return token;
}

export function SignWithCustomDuration(
  payload: object,
  secret: string,
  expiresIn: string,
): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function SignWithRS256AndHeader(
  payload: object,
  secret: string,
  header: JwtHeader,
): string {
  return jwt.sign(payload, secret, { algorithm: 'RS256', header });
}
