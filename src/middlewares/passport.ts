import jwt from 'jsonwebtoken';
import passport from 'passport';

export const passportAuth = passport.authenticate('jwt', { session: false });
export function Sign(data: any, secret: string, expires = false): string {
  const token = expires
    ? jwt.sign({ email: data }, secret, { expiresIn: '14d' })
    : jwt.sign(data, secret);

  return token;
}
