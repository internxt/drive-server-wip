export interface UsageAttributes {
  id: string;
  userId: string;
  delta: number;
  period: Date;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Usage implements UsageAttributes {
  id: string;
  userId: string;
  delta: number;
  period: Date;
  type: string;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    userId,
    delta,
    period,
    type,
    createdAt,
    updatedAt,
  }: UsageAttributes) {
    this.id = id;
    this.userId = userId;
    this.delta = delta;
    this.period = period;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(usage: UsageAttributes): Usage {
    return new Usage(usage);
  }

  isYearly(): boolean {
    return this.type === 'yearly';
  }

  isMonthly(): boolean {
    return this.type === 'monthly';
  }

  toJSON(): Partial<UsageAttributes> {
    return {
      id: this.id,
      userId: this.userId,
      delta: this.delta,
      period: this.period,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
