import { isManagedMailDomain } from './managed-mail-domains';

describe('managed-mail-domains', () => {
  describe('isManagedMailDomain', () => {
    it('When the domain is inxt.eu, then it returns true', () => {
      expect(isManagedMailDomain('alias@inxt.eu')).toBe(true);
    });

    it('When the domain is inxt.me, then it returns true', () => {
      expect(isManagedMailDomain('alias@inxt.me')).toBe(true);
    });

    it('When the domain uses different casing, then it returns true', () => {
      expect(isManagedMailDomain('alias@INXT.EU')).toBe(true);
      expect(isManagedMailDomain('alias@InXt.Me')).toBe(true);
    });

    it('When the domain is not managed, then it returns false', () => {
      expect(isManagedMailDomain('user@gmail.com')).toBe(false);
    });

    it('When the address has no @ sign, then it returns false', () => {
      expect(isManagedMailDomain('not-an-email')).toBe(false);
    });

    it('When the subdomain is not exactly managed, then it returns false', () => {
      expect(isManagedMailDomain('user@mail.inxt.eu')).toBe(false);
    });
  });
});
