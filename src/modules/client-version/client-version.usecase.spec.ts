import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { newClientVersionPolicy } from '../../../test/fixtures';
import {
  type ClientVersionPolicyAttributes,
  ClientVersionStatus,
} from './client-version-policy.domain';
import { type ClientVersionPolicyRepository } from './client-version-policy.repository';
import {
  CLIENT_VERSION_POLICIES_TTL_MS,
  ClientVersionUseCase,
} from './client-version.usecase';

describe('ClientVersionUseCase', () => {
  let useCase: ClientVersionUseCase;
  let policyRepository: DeepMocked<ClientVersionPolicyRepository>;

  const policyRow = (attributes: Partial<ClientVersionPolicyAttributes>) =>
    newClientVersionPolicy({ attributes });

  beforeEach(() => {
    policyRepository = createMock<ClientVersionPolicyRepository>();
    useCase = new ClientVersionUseCase(policyRepository);
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
  });

  const loadPolicies = async () => {
    useCase.getCompatibility('internxt-cli', '1.0.0');
    await jest.runAllTimersAsync();
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('When the policies are not loaded yet, then the app is up to date', () => {
    policyRepository.findAll.mockResolvedValueOnce([
      policyRow({ minVersion: '2.0.0' }),
    ]);

    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility.status).toBe(ClientVersionStatus.UpToDate);
  });

  it('When the app version is deprecated, then the sunset date and recommended version are returned', async () => {
    const sunsetAt = new Date('2099-01-01T00:00:00.000Z');
    policyRepository.findAll.mockResolvedValueOnce([
      policyRow({
        deprecatedBelow: '2.0.0',
        sunsetAt,
        recommendedVersion: '2.8.1',
      }),
    ]);
    await loadPolicies();

    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility).toEqual({
      status: ClientVersionStatus.Deprecated,
      message: 'This version of the app is deprecated. Please update.',
      recommendedVersion: '2.8.1',
      sunsetAt,
    });
  });

  it('When the app has no policy, then it is up to date', async () => {
    policyRepository.findAll.mockResolvedValueOnce([
      policyRow({ client: 'drive-mobile', minVersion: '9.0.0' }),
    ]);
    await loadPolicies();

    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility).toEqual({
      status: ClientVersionStatus.UpToDate,
      message: null,
      recommendedVersion: null,
      sunsetAt: null,
    });
  });

  it('When the policy of the app is invalid, then it is ignored', async () => {
    policyRepository.findAll.mockResolvedValueOnce([
      policyRow({ minVersion: 'latest' }),
    ]);
    await loadPolicies();

    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility.status).toBe(ClientVersionStatus.UpToDate);
  });

  it('When the policies are older than the refresh interval, then they are reloaded', async () => {
    policyRepository.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([policyRow({ minVersion: '2.0.0' })]);
    await loadPolicies();
    jest.setSystemTime(Date.now() + CLIENT_VERSION_POLICIES_TTL_MS + 1);

    useCase.getCompatibility('internxt-cli', '1.0.0');
    await jest.runAllTimersAsync();
    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility.status).toBe(ClientVersionStatus.Unsupported);
  });

  it('When the policies cannot be reloaded, then the previous ones keep applying', async () => {
    policyRepository.findAll
      .mockResolvedValueOnce([policyRow({ minVersion: '2.0.0' })])
      .mockRejectedValueOnce(new Error('Database unavailable'));
    await loadPolicies();
    jest.setSystemTime(Date.now() + CLIENT_VERSION_POLICIES_TTL_MS + 1);

    useCase.getCompatibility('internxt-cli', '1.0.0');
    await jest.runAllTimersAsync();
    const compatibility = useCase.getCompatibility('internxt-cli', '1.0.0');

    expect(compatibility.status).toBe(ClientVersionStatus.Unsupported);
  });
});
