import { CryptoService } from './crypto';

describe('Crypto', () => {
  describe('check crypto as singleton', () => {
    it('create 2 instances and are the same', () => {
      const firstInstance = CryptoService.getInstance();
      const secondInstance = CryptoService.getInstance();
      expect(firstInstance === secondInstance).toBe(true);
    });

    it('encrypt text without random IV', () => {
      const service = CryptoService.getInstance();
      service.encryptName('text to encrypt', 'salt');
    });
  });

  describe('hashSha256', () => {
    const service: CryptoService = CryptoService.getInstance();

    it('should hash correctly', () => {
      const result = service.hashSha256('Azboodo');

      expect(result).toBe(
        '0b9d660f04cb895b899243f88c92e82483d7d881fc6d3d16d229d0e88c33b7e6',
      );
    });

    it('should hash correctly when empty', () => {
      const result = service.hashSha256('');

      expect(result).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });
});
