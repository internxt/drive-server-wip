import { Time } from './time';

describe('Time class', () => {
  const fixedSystemCurrentDate = new Date('2022-01-01');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedSystemCurrentDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('now()', () => {
    it('When is called, then returns the current date', () => {
      const currentDate = Time.now();
      expect(currentDate.getTime()).toBeGreaterThanOrEqual(
        new Date('2022-01-01').getTime(),
      );
    });

    it('When is called and date is provided, then returns the date provided', () => {
      const initialDate = new Date('2022-02-02');
      const currentDate = Time.now(initialDate);
      expect(currentDate).toEqual(initialDate);
    });
  });

  describe('dateWithTimeAdded()', () => {
    it('When days are added, then returns correct current date and days added', () => {
      const systemFutureDate = new Date(fixedSystemCurrentDate);
      systemFutureDate.setDate(systemFutureDate.getDate() + 5);

      const futureDate = Time.dateWithTimeAdded(5, 'day');

      expect(futureDate.getUTCDate()).toBe(systemFutureDate.getUTCDate());
    });

    it('When months are added, then returns correct date with months added', () => {
      const futureDate = Time.dateWithTimeAdded(3, 'month');
      expect(futureDate.getUTCMonth()).toBe(
        Time.dateWithTimeAdded(
          3,
          'month',
          fixedSystemCurrentDate,
        ).getUTCMonth(),
      );
    });

    it('When years are added, then returns correct date with years added', () => {
      const systemFutureDate = new Date(fixedSystemCurrentDate);
      systemFutureDate.setFullYear(systemFutureDate.getFullYear() + 2);

      const futureDate = Time.dateWithTimeAdded(2, 'year');

      expect(futureDate.getUTCFullYear()).toBe(
        systemFutureDate.getUTCFullYear(),
      );
    });
  });

  describe('isToday()', () => {
    it('When provided date is today, then returns true', () => {
      const today = new Date();

      const isToday = Time.isToday(today);

      expect(isToday).toBe(true);
    });

    it('When provided date is another day, then returns false', () => {
      const notToday = new Date();
      notToday.setDate(notToday.getDate() + 1);

      const isToday = Time.isToday(notToday);

      expect(isToday).toBe(false);
    });
  });

  describe('convertTimestampToDate()', () => {
    it('When a date in timestamp is provided, then same date should be returned', () => {
      const timestamp = 1642531200;

      const timestampDate = Time.convertTimestampToDate(timestamp);

      expect(timestampDate).toBeInstanceOf(Date);
      expect(timestampDate).toEqual(new Date(timestamp * 1000));
    });
  });

  describe('daysAgo()', () => {
    it('When days is 0, then returns current date', () => {
      const result = Time.daysAgo(0);

      expect(result.getUTCFullYear()).toBe(
        fixedSystemCurrentDate.getUTCFullYear(),
      );
      expect(result.getUTCMonth()).toBe(fixedSystemCurrentDate.getUTCMonth());
      expect(result.getUTCDate()).toBe(fixedSystemCurrentDate.getUTCDate());
    });

    it('When days is 5, then returns date 5 days ago', () => {
      const expectedDate = new Date(fixedSystemCurrentDate);
      expectedDate.setDate(expectedDate.getDate() - 5);

      const result = Time.daysAgo(5);

      expect(result.getUTCDate()).toBe(expectedDate.getUTCDate());
    });
  });

  describe('startOfYear()', () => {
    it('When called without year parameter, then returns start of current year', () => {
      const result = Time.startOfYear();

      expect(result.getUTCFullYear()).toBe(
        fixedSystemCurrentDate.getUTCFullYear(),
      );
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCHours()).toBe(0);
    });

    it('When called with specific year, then returns start of that year', () => {
      const result = Time.startOfYear(2025);

      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(1);
    });
  });

  describe('startOfDay()', () => {
    it('When called without date, then returns current date at start of day', () => {
      const startOfDay = Time.startOfDay();

      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
      expect(startOfDay.getUTCMilliseconds()).toBe(0);
    });

    it('When called with specific date, then returns that date at start of day', () => {
      const specificDate = new Date('2023-05-15T14:30:45.123Z');

      const startOfDay = Time.startOfDay(specificDate);

      expect(startOfDay.getUTCFullYear()).toBe(2023);
      expect(startOfDay.getUTCMonth()).toBe(4);
      expect(startOfDay.getUTCDate()).toBe(15);
      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
      expect(startOfDay.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('endOfDay()', () => {
    it('When called without date, then returns current date at end of day', () => {
      const endOfDay = Time.endOfDay();

      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
      expect(endOfDay.getUTCMilliseconds()).toBe(999);
    });

    it('When called with specific date, then returns that date at end of day', () => {
      const specificDate = new Date('2023-05-15T14:30:45.123Z');

      const endOfDay = Time.endOfDay(specificDate);

      expect(endOfDay.getUTCFullYear()).toBe(2023);
      expect(endOfDay.getUTCMonth()).toBe(4);
      expect(endOfDay.getUTCDate()).toBe(15);
      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
      expect(endOfDay.getUTCMilliseconds()).toBe(999);
    });
  });

  describe('startOfMonth()', () => {
    it('When called without date, then returns current date at start of month', () => {
      const startOfMonth = Time.startOfMonth();

      expect(startOfMonth.getUTCDate()).toBe(1);
      expect(startOfMonth.getUTCHours()).toBe(0);
      expect(startOfMonth.getUTCMinutes()).toBe(0);
      expect(startOfMonth.getUTCSeconds()).toBe(0);
      expect(startOfMonth.getUTCMilliseconds()).toBe(0);
    });

    it('When called with specific date, then returns that date at start of month', () => {
      const specificDate = Time.now('2023-05-15T14:30:45.123Z');

      const startOfMonth = Time.startOfMonth(specificDate);

      expect(startOfMonth.getUTCMonth()).toBe(4);
      expect(startOfMonth.getUTCDate()).toBe(1);
      expect(startOfMonth.getUTCHours()).toBe(0);
      expect(startOfMonth.getUTCMinutes()).toBe(0);
      expect(startOfMonth.getUTCSeconds()).toBe(0);
      expect(startOfMonth.getUTCMilliseconds()).toBe(0);
    });
  });
});
