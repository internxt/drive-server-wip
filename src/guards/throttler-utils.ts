import jwt from 'jsonwebtoken';

export function decodeUserUuidFromAuth(request: any): string | null {
  if (!request.headers?.authorization) {
    return null;
  }
  try {
    const token = request.headers.authorization.split(' ')[1];
    const decoded: any = jwt.decode(token);
    return decoded?.uuid || decoded?.payload?.uuid || null;
  } catch {
    return null;
  }
}

export function getClientIp(request: any): string {
  const cfIp = request.headers?.['cf-connecting-ip'];
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp;
  }
  return request.ips?.length ? request.ips[0] : request.ip;
}

export function setRateLimitHeaders(
  response: any,
  limit: number,
  totalHits: number,
  timeToExpire: number,
): void {
  const remaining = Math.max(0, limit - totalHits);
  const timeToExpireInSeconds = Math.ceil(timeToExpire / 1000);

  response.header('X-RateLimit-Limit', limit);
  response.header('X-RateLimit-Remaining', remaining);
  response.header('X-RateLimit-Reset', timeToExpireInSeconds);

  response.header('x-internxt-ratelimit-limit', limit);
  response.header('x-internxt-ratelimit-remaining', remaining);
  response.header('x-internxt-ratelimit-reset', timeToExpireInSeconds);
}
