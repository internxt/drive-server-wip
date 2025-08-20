export enum UsageType {
  Daily = 'daily',
  Monthly = 'monthly',
  Yearly = 'yearly',
}
export interface UsageAttributes {
  id: string;
  userId: string;
  delta: number;
  period: Date;
  type: UsageType;
  createdAt: Date;
  updatedAt: Date;
}

export class Usage implements UsageAttributes {
  id: string;
  userId: string;
  delta: number;
  period: Date;
  type: UsageType;
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
    this.period = new Date(period);
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(usage: UsageAttributes): Usage {
    return new Usage(usage);
  }

  isYearly(): boolean {
    return this.type === UsageType.Yearly;
  }

  isPreviousDayTo(targetDate: Date): boolean {
    if (this.isYearly()) {
      return false;
    }

    const nextPeriodStart = this.getNextPeriodStartDate();
    const normalizedTarget = new Date(targetDate);
    normalizedTarget.setUTCHours(0, 0, 0, 0);

    return nextPeriodStart.getTime() === normalizedTarget.getTime();
  }

  getNextPeriodStartDate(): Date {
    const nextPeriod = new Date(this.period);

    if (this.isYearly()) {
      nextPeriod.setUTCFullYear(nextPeriod.getUTCFullYear() + 1);
    } else {
      nextPeriod.setUTCDate(nextPeriod.getUTCDate() + 1);
      nextPeriod.setUTCHours(0, 0, 0, 0);
    }

    return nextPeriod;
  }
}
