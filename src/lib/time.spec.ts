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
});
