import { LimitAttributes } from './limits.attributes';
import { LimitTypes, LimitLabels } from './limits.enum';

export class Limit {
  id: string;
  label: LimitLabels;
  type: string;
  value: number;
  constructor({ id, label, type, value }: LimitAttributes) {
    this.id = id;
    this.label = label;
    this.type = type;
    this.value = value;
  }

  static build(limit: LimitAttributes): Limit {
    return new Limit(limit);
  }

  isLimitBooleanAndEnabled() {
    return this.type === LimitTypes.Boolean && this.value !== 0;
  }
}
