import { assertPublicSharingNavigationSecret } from './configuration';

describe('assertPublicSharingNavigationSecret', () => {
  test('When the navigation secret is missing, then it throws', () => {
    expect(() =>
      assertPublicSharingNavigationSecret({
        jwt: 'jwt-secret',
        publicSharingNavigation: undefined,
      }),
    ).toThrow('PUBLIC_SHARING_NAVIGATION_JWT_SECRET is required');
  });

  test('When the navigation secret equals the jwt secret, then it throws', () => {
    expect(() =>
      assertPublicSharingNavigationSecret({
        jwt: 'same-secret',
        publicSharingNavigation: 'same-secret',
      }),
    ).toThrow(
      'PUBLIC_SHARING_NAVIGATION_JWT_SECRET must differ from JWT_SECRET',
    );
  });

  test('When the navigation secret is set and differs, then it does not throw', () => {
    expect(() =>
      assertPublicSharingNavigationSecret({
        jwt: 'jwt-secret',
        publicSharingNavigation: 'navigation-secret',
      }),
    ).not.toThrow();
  });
});
