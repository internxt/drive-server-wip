import { type Request } from 'express';

export function getClientIp(req: Request): string | null {
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    const firstHop = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;

    return firstHop.split(',')[0].trim() || null;
  }

  return req.ip ?? null;
}
