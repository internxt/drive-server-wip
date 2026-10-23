import { newSharing } from '../../../test/fixtures';
import { SharingType } from './sharing.domain';

describe('Sharing domain', () => {
  describe('isExpired', () => {
    it('When the sharing has no expiration date, then it is not expired', () => {
      const sharing = newSharing({ sharingType: SharingType.Public });

      expect(sharing.isExpired()).toBe(false);
    });

    it('When the expiration date is in the future, then it is not expired', () => {
      const sharing = newSharing({
        sharingType: SharingType.Public,
        expirationAt: new Date(Date.now() + 60 * 1000),
      });

      expect(sharing.isExpired()).toBe(false);
    });

    it('When the expiration date has passed, then it is expired', () => {
      const sharing = newSharing({
        sharingType: SharingType.Public,
        expirationAt: new Date(Date.now() - 60 * 1000),
      });

      expect(sharing.isExpired()).toBe(true);
    });
  });
});
