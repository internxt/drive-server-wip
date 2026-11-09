import { type Request } from 'express';
import { getClientIp } from './request-ip';

const newRequest = (headers: Record<string, unknown>, ip?: string): Request =>
  ({ headers, ip }) as unknown as Request;

describe('getClientIp', () => {
  it('When cf-connecting-ip is set, then it should take precedence over the rest', () => {
    const req = newRequest(
      {
        'cf-connecting-ip': '139.47.19.216',
        'x-forwarded-for': '10.0.0.1',
      },
      '172.18.0.1',
    );

    expect(getClientIp(req)).toBe('139.47.19.216');
  });

  it('When only x-forwarded-for is set, then it should return the first hop', () => {
    const req = newRequest(
      { 'x-forwarded-for': '139.47.19.216, 10.0.0.1, 10.0.0.2' },
      '172.18.0.1',
    );

    expect(getClientIp(req)).toBe('139.47.19.216');
  });

  it('When a proxy header comes as an array, then it should use the first entry', () => {
    const req = newRequest({
      'cf-connecting-ip': ['139.47.19.216', '10.0.0.1'],
    });

    expect(getClientIp(req)).toBe('139.47.19.216');
  });

  it('When no proxy header is set, then it should fall back to the request ip', () => {
    const req = newRequest({}, '172.18.0.1');

    expect(getClientIp(req)).toBe('172.18.0.1');
  });

  it('When no ip is available at all, then it should return null', () => {
    const req = newRequest({});

    expect(getClientIp(req)).toBeNull();
  });
});
