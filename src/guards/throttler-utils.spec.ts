import jwt from 'jsonwebtoken';
import {
  decodeUserUuidFromAuth,
  getClientIp,
  setRateLimitHeaders,
} from './throttler-utils';

describe('throttler-utils', () => {
  describe('decodeUserUuidFromAuth', () => {
    it('When no authorization header then returns null', () => {
      expect(decodeUserUuidFromAuth({ headers: {} })).toBeNull();
    });

    it('When valid JWT with uuid then returns uuid', () => {
      const token = jwt.sign({ uuid: 'user-123' }, 'secret');
      const request = { headers: { authorization: `Bearer ${token}` } };
      expect(decodeUserUuidFromAuth(request)).toBe('user-123');
    });

    it('When valid JWT with payload.uuid then returns uuid', () => {
      const token = jwt.sign({ payload: { uuid: 'user-456' } }, 'secret');
      const request = { headers: { authorization: `Bearer ${token}` } };
      expect(decodeUserUuidFromAuth(request)).toBe('user-456');
    });

    it('When malformed token then returns null', () => {
      const request = { headers: { authorization: 'Bearer not-a-jwt' } };
      expect(decodeUserUuidFromAuth(request)).toBeNull();
    });
  });

  describe('getClientIp', () => {
    it('When cf-connecting-ip is present then returns it', () => {
      const request = {
        headers: { 'cf-connecting-ip': '203.0.113.1' },
        ip: '10.0.0.1',
        ips: [],
      };
      expect(getClientIp(request)).toBe('203.0.113.1');
    });

    it('When cf-connecting-ip is an array then returns first element', () => {
      const request = {
        headers: { 'cf-connecting-ip': ['203.0.113.1', '203.0.113.2'] },
        ip: '10.0.0.1',
        ips: [],
      };
      expect(getClientIp(request)).toBe('203.0.113.1');
    });

    it('When no cf-connecting-ip and ips is populated then returns first ips', () => {
      const request = {
        headers: {},
        ip: '10.0.0.1',
        ips: ['192.168.1.1'],
      };
      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('When no cf-connecting-ip and ips is empty then returns req.ip', () => {
      const request = {
        headers: {},
        ip: '10.0.0.1',
        ips: [],
      };
      expect(getClientIp(request)).toBe('10.0.0.1');
    });
  });

  describe('setRateLimitHeaders', () => {
    it('When called then sets both standard and internxt header families', () => {
      const response = { header: jest.fn() };

      setRateLimitHeaders(response, 100, 30, 5000);

      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 70);
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Reset', 5);

      expect(response.header).toHaveBeenCalledWith(
        'x-internxt-ratelimit-limit',
        100,
      );
      expect(response.header).toHaveBeenCalledWith(
        'x-internxt-ratelimit-remaining',
        70,
      );
      expect(response.header).toHaveBeenCalledWith(
        'x-internxt-ratelimit-reset',
        5,
      );
    });

    it('When totalHits exceeds limit then remaining is 0', () => {
      const response = { header: jest.fn() };

      setRateLimitHeaders(response, 10, 15, 3000);

      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
      expect(response.header).toHaveBeenCalledWith(
        'x-internxt-ratelimit-remaining',
        0,
      );
    });

    it('When timeToExpire has fractional seconds then rounds up', () => {
      const response = { header: jest.fn() };

      setRateLimitHeaders(response, 100, 50, 2500);

      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Reset', 3);
      expect(response.header).toHaveBeenCalledWith(
        'x-internxt-ratelimit-reset',
        3,
      );
    });
  });
});
