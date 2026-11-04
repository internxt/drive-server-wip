import { Injectable, Logger } from '@nestjs/common';
import {
  type ClientVersionPolicy,
  ClientVersionStatus,
} from './client-version-policy.domain';
import { ClientVersionPolicyRepository } from './client-version-policy.repository';
import { type ClientCompatibilityResponseDto } from './dto/client-compatibility-response.dto';

export const CLIENT_VERSION_POLICIES_TTL_MS = 60 * 1000;

const MESSAGE_BY_STATUS: Record<ClientVersionStatus, string | null> = {
  [ClientVersionStatus.UpToDate]: null,
  [ClientVersionStatus.UpdateRecommended]:
    'A new version of the app is available. Please update.',
  [ClientVersionStatus.Deprecated]:
    'This version of the app is deprecated. Please update.',
  [ClientVersionStatus.Unsupported]:
    'This version of the app is no longer supported. Please update to a newer version.',
};

@Injectable()
export class ClientVersionUseCase {
  private readonly logger = new Logger(ClientVersionUseCase.name);
  private policies = new Map<string, ClientVersionPolicy>();
  private lastRefreshAt = 0;

  constructor(
    private readonly policyRepository: ClientVersionPolicyRepository,
  ) {}

  getCompatibility(
    client: string,
    version: string,
  ): ClientCompatibilityResponseDto {
    this.refreshIfStale();

    const policy =
      this.policies.get(`${client}@${version}`) ?? this.policies.get(client);
    const status = policy?.getStatus(version) ?? ClientVersionStatus.UpToDate;

    return {
      status,
      message: MESSAGE_BY_STATUS[status],
      recommendedVersion: policy?.recommendedVersion ?? null,
      sunsetAt:
        status === ClientVersionStatus.Deprecated ? policy.sunsetAt : null,
    };
  }

  async refreshPolicies(): Promise<void> {
    this.lastRefreshAt = Date.now();

    try {
      const policies = await this.policyRepository.findAll();
      this.policies = new Map(
        policies
          .filter((policy) => this.isUsable(policy))
          .map((policy) => [
            policy.version
              ? `${policy.client}@${policy.version}`
              : policy.client,
            policy,
          ]),
      );
    } catch (error) {
      this.logger.error(
        { error: error?.message },
        'Failed to refresh client version policies, keeping previous snapshot',
      );
    }
  }

  private refreshIfStale(): void {
    const isStale =
      Date.now() - this.lastRefreshAt > CLIENT_VERSION_POLICIES_TTL_MS;
    if (isStale) {
      void this.refreshPolicies();
    }
  }

  private isUsable(policy: ClientVersionPolicy): boolean {
    if (policy.isValid()) {
      return true;
    }

    this.logger.error(
      { client: policy.client },
      'Invalid client version policy, ignoring it',
    );
    return false;
  }
}
