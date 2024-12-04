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
    expect(usage.isMonthly()).toBe(false);
    expect(usage.isDaily()).toBe(false);
  });

  it('When Usage type is Monthly, then isMonthly should return true', () => {
    const usage = Usage.build({ ...usageAttributes, type: UsageType.Monthly });

    expect(usage.isYearly()).toBe(false);
    expect(usage.isMonthly()).toBe(true);
    expect(usage.isDaily()).toBe(false);
  });

  it('When Usage type is Daily, then isDaily should return true', () => {
    const usage = Usage.build({ ...usageAttributes, type: UsageType.Daily });

    expect(usage.isYearly()).toBe(false);
    expect(usage.isMonthly()).toBe(false);
    expect(usage.isDaily()).toBe(true);
  });

  it('When instance is created, then period should be parsed to date', () => {
    const usage = Usage.build(usageAttributes);

    expect(usage.period).toBeInstanceOf(Date);
  });
});
