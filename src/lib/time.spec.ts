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

  describe('dateWithDaysAdded()', () => {
    it('When days are added, then returns correct current date and days added', () => {
      const systemFutureDate = new Date(fixedSystemCurrentDate);
      systemFutureDate.setDate(systemFutureDate.getDate() + 5);

      const futureDate = Time.dateWithDaysAdded(5);

      expect(futureDate.getUTCDate()).toBe(systemFutureDate.getUTCDate());
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

  describe('startOfDay()', () => {
    it('When called without date, then returns current date at start of day', () => {
      const startOfDay = Time.startOfDay();

      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);
    });

    it('When called with specific date, then returns that date at start of day', () => {
      const specificDate = new Date('2023-05-15 14:30:45.123');

      const startOfDay = Time.startOfDay(specificDate);

      expect(startOfDay.getFullYear()).toBe(2023);
      expect(startOfDay.getMonth()).toBe(4);
      expect(startOfDay.getDate()).toBe(15);
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);
    });
  });

  describe('endOfDay()', () => {
    it('When called without date, then returns current date at end of day', () => {
      const endOfDay = Time.endOfDay();

      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
      expect(endOfDay.getMilliseconds()).toBe(999);
    });

    it('When called with specific date, then returns that date at end of day', () => {
      const specificDate = new Date('2023-05-15 14:30:45.123');

      const endOfDay = Time.endOfDay(specificDate);

      expect(endOfDay.getFullYear()).toBe(2023);
      expect(endOfDay.getMonth()).toBe(4);
      expect(endOfDay.getDate()).toBe(15);
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
      expect(endOfDay.getMilliseconds()).toBe(999);
    });
  });
});
