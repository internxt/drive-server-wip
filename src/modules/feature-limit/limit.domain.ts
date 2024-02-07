import { LimitAttributes } from './limits.attributes';
import { LimitTypes, LimitLabels } from './limits.enum';

export class Limit {
  id: string;
  label: LimitLabels;
  type: string;
  value: string;
  constructor({ id, label, type, value }: LimitAttributes) {
    this.id = id;
    this.label = label;
    this.type = type;
    this.value = value;
  }

  static build(limit: LimitAttributes): Limit {
    return new Limit(limit);
  }

  isLimitBoolean() {
    return this.type === LimitTypes.Boolean;
  }

  isFeatureEnabled() {
    return this.isLimitBoolean() && Boolean(this.value);
  }

  isLimitExceeded(currentCount: number) {
    return (
      this.type === LimitTypes.counter && currentCount >= Number(this.value)
    );
  }
}
