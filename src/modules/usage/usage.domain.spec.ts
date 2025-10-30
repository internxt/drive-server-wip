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

  describe('isAtOrBeforePeriod', () => {
    const yearlyPeriod = new Date('2024-01-01T00:00:00.000Z');
    const monthlyPeriod = new Date('2024-06-15T00:00:00.000Z');

    it('When usage is yearly and date is within the same year, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Yearly,
        period: yearlyPeriod,
      });

      const dateInMiddleOfYear = new Date('2024-06-15T00:00:00.000Z');
      const dateAtStartOfYear = new Date('2024-01-01T00:00:00.000Z');
      const dateAtEndOfYear = new Date('2024-12-31T23:59:59.999Z');

      expect(usage.isAtOrBeforePeriod(dateInMiddleOfYear)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateAtStartOfYear)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateAtEndOfYear)).toBe(true);
    });

    it('When usage is yearly and  date is before the period year, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Yearly,
        period: yearlyPeriod,
      });

      const dateAtEndOfPreviousYear = new Date('2023-12-31T00:00:00.000Z');
      const dateAtStartOfPreviousYear = new Date('2023-01-01T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateAtEndOfPreviousYear)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateAtStartOfPreviousYear)).toBe(true);
    });

    it('When usage is yearly and  date is after the period year, then should return false', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Yearly,
        period: yearlyPeriod,
      });

      const dateAtStartOfNextYear = new Date('2025-01-01T00:00:00.000Z');
      const dateInMiddleOfNextYear = new Date('2025-06-15T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateAtStartOfNextYear)).toBe(false);
      expect(usage.isAtOrBeforePeriod(dateInMiddleOfNextYear)).toBe(false);
    });

    it('When usage is monthly or daily and date equals the period, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: monthlyPeriod,
      });

      const dateSameAsPeriod = new Date('2024-06-15T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateSameAsPeriod)).toBe(true);
    });

    it('When usage is monthly or daily and date is before the period, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: monthlyPeriod,
      });

      const dateDayBefore = new Date('2024-06-14T00:00:00.000Z');
      const dateMonthsBefore = new Date('2024-01-01T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateDayBefore)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateMonthsBefore)).toBe(true);
    });

    it('When date is after the period, then should return false', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: monthlyPeriod,
      });

      const dateDayAfter = new Date('2024-06-16T00:00:00.000Z');
      const dateMonthsAfter = new Date('2024-12-31T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateDayAfter)).toBe(false);
      expect(usage.isAtOrBeforePeriod(dateMonthsAfter)).toBe(false);
    });

    it('When usage is monthly or daily and date has different time but same day, then should return true', () => {
      const periodWithTime = new Date('2024-06-15T10:30:00.000Z');
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: periodWithTime,
      });

      const sameDayDifferentTime = new Date('2024-06-15T23:59:59.999Z');

      expect(usage.isAtOrBeforePeriod(sameDayDifferentTime)).toBe(true);
    });
  });
});
