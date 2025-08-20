import { v4 } from 'uuid';
import { Usage, UsageType } from './usage.domain';

describe('Usage Domain', () => {
  const usageAttributes = {
    id: v4(),
    userId: v4(),
    delta: 100,
    period: new Date(),
    type: UsageType.Daily,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('When Usage type is Yearly, then isYearly should return true', () => {
    const usage = Usage.build({ ...usageAttributes, type: UsageType.Yearly });

    expect(usage.isYearly()).toBe(true);
  });
  it('When Usage type is not yearly, then isYearly should return false', () => {
    const usage = Usage.build({ ...usageAttributes, type: UsageType.Monthly });

    expect(usage.isYearly()).toBe(false);
  });

  it('When instance is created, then period should be parsed to date', () => {
    const usage = Usage.build(usageAttributes);

    expect(usage.period).toBeInstanceOf(Date);
  });

  it('When usage is daily, then getNextPeriodStartDate should return next day', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Daily,
      period: new Date('2024-01-15T00:00:00.000Z'),
    });

    const nextPeriod = usage.getNextPeriodStartDate();

    expect(nextPeriod).toEqual(new Date('2024-01-16T00:00:00.000Z'));
  });

  it('When usage is yearly, then getNextPeriodStartDate should return next year', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Yearly,
      period: new Date('2024-01-15T00:00:00.000Z'),
    });

    const nextPeriod = usage.getNextPeriodStartDate();

    expect(nextPeriod).toEqual(new Date('2025-01-15T00:00:00.000Z'));
  });

  it('When usage is previous day to target, then isPreviousDayTo should return true', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Daily,
      period: new Date('2024-01-15T00:00:00.000Z'),
    });

    const result = usage.isPreviousDayTo(new Date('2024-01-16T00:00:00.000Z'));

    expect(result).toBe(true);
  });

  it('When usage is yearly, then isPreviousDayTo should return false', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Yearly,
      period: new Date('2024-01-15T00:00:00.000Z'),
    });

    const result = usage.isPreviousDayTo(new Date('2025-01-15T00:00:00.000Z'));

    expect(result).toBe(false);
  });
});
