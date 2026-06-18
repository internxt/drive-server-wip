import jwt, { type JwtHeader, type SignOptions } from 'jsonwebtoken';

// `expiresIn` is typed as a template-literal union (`StringValue`) in
// @types/jsonwebtoken, but jsonwebtoken accepts any duration string at
// runtime. This cast is the single place that bridges the two.
export function signWithExpiry(
  payload: string | object | Buffer,
  secret: jwt.Secret,
  options?: Omit<SignOptions, 'expiresIn'> & { expiresIn?: string | number },
): string {
  return jwt.sign(payload, secret, options as SignOptions);
}

export function SignEmail(
  email: string,
  secret: string,
  expirationTime?: string | number,
  customIat?: number,
): string {
  const payload = { email, ...(customIat ? { iat: customIat } : null) };

  const token = expirationTime
    ? signWithExpiry(payload, secret, { expiresIn: expirationTime })
    : jwt.sign(payload, secret);

  return token;
}

export function Sign(
  payload: object,
  secret: string,
  expirationTime?: string | number,
): string {
  const token = expirationTime
    ? signWithExpiry(payload, secret, { expiresIn: expirationTime })
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
  return signWithExpiry(payload, secret, { expiresIn });
}

export function SignWithRS256AndHeader(
  payload: object,
  secret: string,
  header: JwtHeader,
): string {
  return jwt.sign(payload, secret, { algorithm: 'RS256', header });
}
