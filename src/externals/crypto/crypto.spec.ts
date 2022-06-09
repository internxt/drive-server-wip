import { CryptoService } from './crypto';

describe('Crypto', () => {
  describe('check crypto as singleton', () => {
    it('create 2 instances and are the same', () => {
      const firstInstance = CryptoService.getInstance();
      const secondInstance = CryptoService.getInstance();
      expect(firstInstance === secondInstance).toBe(true);
    });
  });
});
