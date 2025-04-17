import jwt from 'jsonwebtoken';
import {
  SignEmail,
  Sign,
  getFutureIAT,
  SignWithCustomDuration,
} from './passport';

describe('JWT Utility Functions', () => {
  const secret = 'test_secret';
  const payload = { userId: '12345' };

  describe('SignEmail', () => {
    it('When called with email and secret, then it returns a valid token', () => {
      const token = SignEmail('test@example.com', secret);
      const decoded = jwt.verify(token, secret);

      expect(decoded).toHaveProperty('email', 'test@example.com');
    });

    it('When called with custom iat, then it sets the iat', () => {
      const customIat = Math.floor(Date.now() / 1000 + 60);
      const token = SignEmail('test@example.com', secret, false, customIat);
      const decoded = jwt.verify(token, secret);

      expect(decoded).toHaveProperty('iat', customIat);
    });

    it('When token should expire, then it sets an expiration date', () => {
      const token = SignEmail('test@example.com', secret, true);
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.payload).toHaveProperty('exp');
    });
  });

  describe('Sign', () => {
    it('When called with a payload and secret, then it returns a valid token', () => {
      const token = Sign(payload, secret);
      const decoded = jwt.verify(token, secret);

      expect(decoded).toMatchObject(payload);
    });

    it('When token should expire, then it sets an expiration date', () => {
      const token = Sign(payload, secret, true);
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.payload).toHaveProperty('exp');
    });
  });

  describe('getFutureIAT', () => {
    it('When called, then it returns a future IAT timestamp', () => {
      const futureIAT = getFutureIAT();
      const currentTime = Math.floor(Date.now() / 1000);

      expect(futureIAT).toBeGreaterThan(currentTime);
    });
  });

  describe('SignWithCustomDuration', () => {
    it('When called with a custom expiration, then it sets the correct expiration', () => {
      const token = SignWithCustomDuration(payload, secret, '7d');
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.payload).toHaveProperty('exp');
    });
  });
});
