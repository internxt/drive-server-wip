import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'vitest-mock-extended';
import { CryptoService } from './crypto.service';

describe('Crypto', () => {
  let cryptoService: CryptoService;

  beforeEach(async () => {
    const configService = mockDeep<ConfigService>();
    configService.get.mockReturnValue('test');

    cryptoService = new CryptoService(configService);
  });

  describe('check crypto as singleton', () => {
    it('encrypt text without random IV does not throw an exception', () => {
      cryptoService.encryptName('text to encrypt', 1453363321);
    });
  });

  describe('hashSha256', () => {
    it('should hash correctly', () => {
      const result = cryptoService.hashSha256('Azboodo');

      expect(result).toBe(
        '0b9d660f04cb895b899243f88c92e82483d7d881fc6d3d16d229d0e88c33b7e6',
      );
    });

    it('should hash correctly when empty', () => {
      const result = cryptoService.hashSha256('');

      expect(result).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });
});
