import {
  type LimitAttributes,
  type ShouldLimitBeEnforcedContext,
} from './limits.attributes';
import { LimitTypes, type LimitLabels } from '../limits.enum';

export class Limit {
  readonly id: string;
  readonly label: LimitLabels;
  readonly type: string;
  readonly value: string;
  readonly isBypassable: boolean;

  constructor({ id, label, type, value }: LimitAttributes) {
    this.id = id;
    this.label = label;
    this.type = type;
    this.value = value;
  }

  static build(limitAttributes: LimitAttributes): Limit {
    return new Limit(limitAttributes);
  }

  isBooleanLimit() {
    return this.type === LimitTypes.Boolean;
  }

  isFeatureEnabled() {
    return this.isBooleanLimit() && this.value === 'true';
  }

  private isCounterLimitExceeded(currentCount: number) {
    return (
      this.type === LimitTypes.Counter && currentCount >= Number(this.value)
    );
  }

  shouldLimitBeEnforced(context: ShouldLimitBeEnforcedContext = {}): boolean {
    const { bypassLimit, currentCount } = context;

    if (bypassLimit) {
      return false;
    }

    if (this.isBooleanLimit()) {
      return !this.isFeatureEnabled();
    }

    return this.isCounterLimitExceeded(currentCount);
  }
}
