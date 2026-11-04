import { newClientVersionPolicy } from '../../../test/fixtures';
import { ClientVersionStatus } from './client-version-policy.domain';

describe('ClientVersionPolicy', () => {
  const policy = newClientVersionPolicy({
    attributes: {
      minVersion: '1.0.0',
      deprecatedBelow: '2.0.0',
      sunsetAt: new Date('2026-12-01T00:00:00.000Z'),
      recommendedVersion: '3.0.0',
    },
  });

  it.each([
    ['0.9.0', ClientVersionStatus.Unsupported],
    ['1.5.0', ClientVersionStatus.Deprecated],
    ['2.5.0', ClientVersionStatus.UpdateRecommended],
    ['3.0.0', ClientVersionStatus.UpToDate],
  ])('When the app version is %s, then it is %s', (version, expected) => {
    const status = policy.getStatus(version);

    expect(status).toBe(expected);
  });

  it('When the sunset date has passed, then deprecated versions are still deprecated', () => {
    const pastSunsetPolicy = newClientVersionPolicy({
      attributes: {
        deprecatedBelow: '2.0.0',
        sunsetAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });

    const status = pastSunsetPolicy.getStatus('1.5.0');

    expect(status).toBe(ClientVersionStatus.Deprecated);
  });

  it('When no version is set, then every version is up to date', () => {
    const emptyPolicy = newClientVersionPolicy();

    const status = emptyPolicy.getStatus('0.0.1');

    expect(status).toBe(ClientVersionStatus.UpToDate);
  });

  it('When versions are valid and in order, then the policy is valid', () => {
    expect(policy.isValid()).toBe(true);
  });

  it.each([
    ['a version is not semver', { minVersion: 'latest' }],
    [
      'the minimum is above the recommended version',
      { minVersion: '3.0.0', recommendedVersion: '2.0.0' },
    ],
  ])('When %s, then the policy is invalid', (_, attributes) => {
    const invalidPolicy = newClientVersionPolicy({ attributes });

    expect(invalidPolicy.isValid()).toBe(false);
  });
});
