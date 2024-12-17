import { TwoFactorAuthService } from './two-factor-auth.service';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;

  beforeEach(async () => {
    service = new TwoFactorAuthService();
  });

  it('When the service is instantiated, then it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTwoFactorAuthSecret', () => {
    it('When generating a two-factor authentication secret, then it should return a secret and a QR code', async () => {
      qrcode.toDataURL.mockResolvedValueOnce('data:image/png;base64,iVB');
      const result = await service.generateTwoFactorAuthSecret();
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result.secret).toHaveProperty('ascii');
      expect(typeof result.qrCode).toBe('string');
    });

    it('When an error occurs during QR code generation, then it should throw', async () => {
      qrcode.toDataURL.mockRejectedValueOnce(new Error());
      await expect(service.generateTwoFactorAuthSecret()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('validateTwoFactorAuthCode', () => {
    it('When a valid code is provided, then it should return true', async () => {
      const secret = speakeasy.generateSecret({ length: 10 }).ascii;
      const token = speakeasy.totp({
        secret,
        encoding: 'base32',
      });
      const result = await service.validateTwoFactorAuthCode(secret, token);
      expect(result).toBe(true);
    });

    it('When an invalid code is provided, then it should throw', async () => {
      const secret = speakeasy.generateSecret({ length: 10 }).ascii;
      await expect(
        service.validateTwoFactorAuthCode(secret, 'invalid-code'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
