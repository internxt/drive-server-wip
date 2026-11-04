import * as semver from 'semver';

export enum ClientVersionStatus {
  UpToDate = 'up_to_date',
  UpdateRecommended = 'update_recommended',
  Deprecated = 'deprecated',
  Unsupported = 'unsupported',
}

export interface ClientVersionPolicyAttributes {
  id: number;
  client: string;
  version: string | null;
  minVersion: string | null;
  deprecatedBelow: string | null;
  sunsetAt: Date | null;
  recommendedVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ClientVersionPolicy implements ClientVersionPolicyAttributes {
  id: number;
  client: string;
  version: string | null;
  minVersion: string | null;
  deprecatedBelow: string | null;
  sunsetAt: Date | null;
  recommendedVersion: string | null;
  createdAt: Date;
  updatedAt: Date;

  private constructor(attributes: ClientVersionPolicyAttributes) {
    Object.assign(this, attributes);
  }

  static build(attributes: ClientVersionPolicyAttributes): ClientVersionPolicy {
    return new ClientVersionPolicy(attributes);
  }

  isValid(): boolean {
    if (this.version !== null && semver.valid(this.version) !== this.version) {
      return false;
    }

    const thresholds = [
      this.minVersion,
      this.deprecatedBelow,
      this.recommendedVersion,
    ].filter((threshold) => threshold !== null);

    const areValidVersions = thresholds.every((threshold) =>
      semver.valid(threshold),
    );
    if (!areValidVersions) {
      return false;
    }

    return thresholds.every(
      (threshold, index) =>
        index === 0 || semver.lte(thresholds[index - 1], threshold),
    );
  }

  getStatus(version: string): ClientVersionStatus {
    const isBelow = (threshold: string | null) =>
      threshold !== null && semver.lt(version, threshold);

    if (isBelow(this.minVersion)) {
      return ClientVersionStatus.Unsupported;
    }

    if (isBelow(this.deprecatedBelow)) {
      return ClientVersionStatus.Deprecated;
    }

    if (isBelow(this.recommendedVersion)) {
      return ClientVersionStatus.UpdateRecommended;
    }

    return ClientVersionStatus.UpToDate;
  }
}
