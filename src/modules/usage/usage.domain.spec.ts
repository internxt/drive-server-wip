import { v4 } from 'uuid';
import { Usage, UsageType } from './usage.domain';
import { Time } from '../../lib/time';

describe('Usage Domain', () => {
  const usageAttributes = {
    id: v4(),
    userId: v4(),
    delta: 100,
    period: Time.now(),
    type: UsageType.Daily,
    createdAt: Time.now(),
    updatedAt: Time.now(),
  };

  it('When instance is created, then period should be parsed to date', () => {
    const usage = Usage.build(usageAttributes);

    expect(usage.period).toBeInstanceOf(Date);
  });

  it('When usage is daily, then it should return next day', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Daily,
      period: Time.now('2024-01-15T00:00:00.000Z'),
    });

    const nextPeriod = usage.getNextPeriodStartDate();

    expect(nextPeriod).toEqual(Time.now('2024-01-16T00:00:00.000Z'));
  });

  it('When usage is yearly, then should return next start of next year', () => {
    const usage = Usage.build({
      ...usageAttributes,
      type: UsageType.Yearly,
      period: Time.now('2024-01-15T00:00:00.000Z'),
    });

    const nextPeriod = usage.getNextPeriodStartDate();

    expect(nextPeriod).toEqual(Time.now('2025-01-01T00:00:00.000Z'));
  });

  describe('isAtOrBeforePeriod', () => {
    const yearlyPeriod = Time.now('2024-01-01T00:00:00.000Z');
    const dailyPeriod = Time.now('2024-06-15T00:00:00.000Z');

    it('When usage is yearly and date is within the same year, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Yearly,
        period: yearlyPeriod,
      });

      const dateInMiddleOfYear = Time.now('2024-06-15T00:00:00.000Z');
      const dateAtStartOfYear = Time.now('2024-01-01T00:00:00.000Z');
      const dateAtEndOfYear = Time.now('2024-12-31T23:59:59.999Z');

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

      const dateAtEndOfPreviousYear = Time.now('2023-12-31T00:00:00.000Z');
      const dateAtStartOfPreviousYear = Time.now('2023-01-01T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateAtEndOfPreviousYear)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateAtStartOfPreviousYear)).toBe(true);
    });

    it('When usage is yearly and  date is after the period year, then should return false', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Yearly,
        period: yearlyPeriod,
      });

      const dateAtStartOfNextYear = Time.now('2025-01-01T00:00:00.000Z');
      const dateInMiddleOfNextYear = Time.now('2025-06-15T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateAtStartOfNextYear)).toBe(false);
      expect(usage.isAtOrBeforePeriod(dateInMiddleOfNextYear)).toBe(false);
    });

    it('When usage is monthly or daily and date equals the period, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: dailyPeriod,
      });

      const dateSameAsPeriod = Time.now('2024-06-15T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateSameAsPeriod)).toBe(true);
    });

    it('When usage is monthly or daily and date is before the period, then should return true', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: dailyPeriod,
      });

      const dateDayBefore = Time.now('2024-06-14T00:00:00.000Z');
      const dateMonthsBefore = Time.now('2024-01-01T00:00:00.000Z');

      expect(usage.isAtOrBeforePeriod(dateDayBefore)).toBe(true);
      expect(usage.isAtOrBeforePeriod(dateMonthsBefore)).toBe(true);
    });

    it('When date is after the period, then should return false', () => {
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Daily,
        period: dailyPeriod,
      });

      const dateDayAfter = Time.dateWithTimeAdded(1, 'day', dailyPeriod);
      const dateMonthsAfter = Time.dateWithTimeAdded(1, 'month', dailyPeriod);

      expect(usage.isAtOrBeforePeriod(dateDayAfter)).toBe(false);
      expect(usage.isAtOrBeforePeriod(dateMonthsAfter)).toBe(false);
    });

    it('When usage is monthly or daily and date has different time but same day, then should return true', () => {
      const periodWithTime = Time.now('2024-06-15T10:30:00.000Z');
      const usage = Usage.build({
        ...usageAttributes,
        type: UsageType.Monthly,
        period: periodWithTime,
      });

      const sameDayDifferentTime = Time.now('2024-06-15T23:59:59.999Z');

      expect(usage.isAtOrBeforePeriod(sameDayDifferentTime)).toBe(true);
    });
  });
});
