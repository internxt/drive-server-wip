import axios from 'axios';
import { CaptchaService } from './captcha.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CaptchaService', () => {
  let service: CaptchaService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaptchaService();
    process.env = { ...originalEnv, NODE_ENV: 'production' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('When not in production, then it skips verification and returns true', async () => {
    process.env.NODE_ENV = 'development';

    const result = await service.verifyCaptcha('any-token', '1.2.3.4');

    expect(result).toBe(true);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  describe('reCAPTCHA provider (default)', () => {
    beforeEach(() => {
      process.env.CAPTCHA_PROVIDER = 'recaptcha';
      process.env.RECAPTCHA_V3_ENDPOINT = 'https://recaptcha.test/verify';
      process.env.RECAPTCHA_V3 = 'recaptcha-secret';
      process.env.RECAPTCHA_V3_SCORE_THRESHOLD = '0.5';
    });

    it('When success and score is above threshold, then it returns true', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, score: 0.9 },
      });

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://recaptcha.test/verify',
        expect.stringContaining('secret=recaptcha-secret'),
        expect.anything(),
      );
    });

    it('When score is below threshold, then it returns false', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, score: 0.1 },
      });

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(false);
    });

    it('When verification is not successful, then it returns false', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: false, 'error-codes': ['invalid-input-response'] },
      });

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(false);
    });
  });

  describe('Turnstile provider', () => {
    beforeEach(() => {
      process.env.CAPTCHA_PROVIDER = 'turnstile';
      process.env.TURNSTILE_ENDPOINT = 'https://turnstile.test/siteverify';
      process.env.TURNSTILE_SECRET = 'turnstile-secret';
    });

    it('When success is true, then it returns true without checking any score', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, challenge_ts: '2026-07-24T00:00:00Z' },
      });

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://turnstile.test/siteverify',
        expect.stringContaining('secret=turnstile-secret'),
        expect.anything(),
      );
    });

    it('When it falls back to the default Cloudflare endpoint if none is configured', async () => {
      delete process.env.TURNSTILE_ENDPOINT;
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await service.verifyCaptcha('token', '1.2.3.4');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.any(String),
        expect.anything(),
      );
    });

    it('When success is false, then it returns false', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: false, 'error-codes': ['timeout-or-duplicate'] },
      });

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(false);
    });

    it('When the request throws, then it returns false', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('network error'));

      const result = await service.verifyCaptcha('token', '1.2.3.4');

      expect(result).toBe(false);
    });
  });
});
