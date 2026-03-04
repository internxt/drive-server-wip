import jwt, { type JwtHeader } from 'jsonwebtoken';

export function SignEmail(
  email: string,
  secret: string,
  expirationTime?: string | number,
  customIat?: number,
): string {
  const payload = { email, ...(customIat ? { iat: customIat } : null) };

  const token = expirationTime
    ? jwt.sign(payload, secret, { expiresIn: expirationTime })
    : jwt.sign(payload, secret);

  return token;
}

export function Sign(
  payload: object,
  secret: string,
  expirationTime?: string | number,
): string {
  const token = expirationTime
    ? jwt.sign(payload, secret, { expiresIn: expirationTime })
    : jwt.sign(payload, secret);

  return token;
}

export function getFutureIAT() {
  return Math.floor(Date.now() / 1000) + 60;
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
