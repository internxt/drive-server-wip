import { Time } from '../../lib/time';

export enum UsageType {
  // Temporal Types
  Daily = 'daily',
  Monthly = 'monthly',
  Yearly = 'yearly',
  // Events Types
  Replacement = 'replacement',
}

const temporalUsage = new Set([
  UsageType.Daily,
  UsageType.Monthly,
  UsageType.Yearly,
]);

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
    this.delta = Number(delta);
    this.period = new Date(period);
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(usage: UsageAttributes): Usage {
    return new Usage(usage);
  }
  isTemporal(): boolean {
    return temporalUsage.has(this.type);
  }

  getNextPeriodStartDate(): Date {
    switch (this.type) {
      case UsageType.Daily:
        return Time.startOf(
          Time.dateWithTimeAdded(1, 'day', this.period),
          'day',
        );
      case UsageType.Monthly:
        return Time.startOf(
          Time.dateWithTimeAdded(1, 'month', this.period),
          'month',
        );
      case UsageType.Yearly:
        return Time.startOf(
          Time.dateWithTimeAdded(1, 'year', this.period),
          'year',
        );
      default:
        throw new Error(
          `Cannot get next period start date for non-temporal usage of type ${this.type}`,
        );
    }
  }

  isAtOrBeforePeriod(date: Date): boolean {
    switch (this.type) {
      case UsageType.Daily:
        return Time.isSameOrBefore(date, this.period, 'day');
      case UsageType.Monthly:
        return Time.isSameOrBefore(date, this.period, 'month');
      case UsageType.Yearly:
        return Time.isSameOrBefore(date, this.period, 'year');
      default:
        throw new Error(
          `Cannot check period comparison for non-temporal usage of type ${this.type}`,
        );
    }
  }
}
